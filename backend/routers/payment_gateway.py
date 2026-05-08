import hashlib
import hmac
import json as _json
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.orm import Session

from database import get_db
from auth import require_roles, generate_id, log_audit, encrypt_secret, decrypt_secret, mask_secret
import models

webhook_router = APIRouter(prefix="/api/webhooks/payment", tags=["payment-webhook"])

router = APIRouter(prefix="/api/settings/payment", tags=["payment-gateway"])
PG_ADMIN_ROLES = ("SUPER_ADMIN", "CLINIC_MANAGER")
VALID_PROVIDERS = {"stripe", "tap", "payfort", "hesabe", "telr", "paypal", "custom"}


class PaymentUpdate(BaseModel):
    provider: Optional[str] = Field(None, max_length=30)
    publicKey: Optional[str] = Field(None, max_length=255)
    secretKey: Optional[str] = None
    webhookSecret: Optional[str] = None
    currency: Optional[str] = Field(None, max_length=10)
    testMode: Optional[bool] = None
    isActive: Optional[bool] = None


def _get_or_create(db: Session, branch_id: Optional[str] = None) -> models.PaymentGatewayConfig:
    cfg = db.query(models.PaymentGatewayConfig).filter(models.PaymentGatewayConfig.branchId == branch_id).first()
    if not cfg:
        cfg = models.PaymentGatewayConfig(id=generate_id(), branchId=branch_id)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def pg_to_dict(c: models.PaymentGatewayConfig) -> dict:
    return {
        "branchId": c.branchId,
        "provider": c.provider or "stripe",
        "publicKey": c.publicKey or "",
        "secretKeyMasked": mask_secret(decrypt_secret(c.secretKeyEncrypted or "")),
        "webhookSecretMasked": mask_secret(decrypt_secret(c.webhookSecretEncrypted or "")),
        "currency": c.currency or "USD",
        "testMode": bool(c.testMode),
        "isActive": bool(c.isActive),
    }


@router.get("")
def get_global_pg(db: Session = Depends(get_db), _user=Depends(require_roles(*PG_ADMIN_ROLES))):
    return pg_to_dict(_get_or_create(db, None))


@router.patch("")
def update_global_pg(body: PaymentUpdate, db: Session = Depends(get_db), user=Depends(require_roles(*PG_ADMIN_ROLES))):
    return _update(None, body, db, user)


@router.get("/{branch_id}")
def get_branch_pg(branch_id: str, db: Session = Depends(get_db), _user=Depends(require_roles(*PG_ADMIN_ROLES))):
    _ensure_branch(branch_id, db)
    return pg_to_dict(_get_or_create(db, branch_id))


@router.patch("/{branch_id}")
def update_branch_pg(
    branch_id: str, body: PaymentUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*PG_ADMIN_ROLES)),
):
    _ensure_branch(branch_id, db)
    return _update(branch_id, body, db, user)


def _update(branch_id, body: PaymentUpdate, db: Session, user):
    if body.provider and body.provider not in VALID_PROVIDERS:
        raise HTTPException(422, f"Invalid provider. Valid: {', '.join(sorted(VALID_PROVIDERS))}")
    cfg = _get_or_create(db, branch_id)
    updates = body.model_dump(exclude_none=True)
    if "secretKey" in updates:
        cfg.secretKeyEncrypted = encrypt_secret(updates.pop("secretKey"))
    if "webhookSecret" in updates:
        cfg.webhookSecretEncrypted = encrypt_secret(updates.pop("webhookSecret"))
    for field, val in updates.items():
        setattr(cfg, field, val)
    db.commit()
    db.refresh(cfg)
    log_audit(db, user.id, "UPDATE", "PaymentGatewayConfig", cfg.id, {"branchId": branch_id})
    return pg_to_dict(cfg)


def _ensure_branch(branch_id: str, db: Session):
    if not db.query(models.Branch).filter(models.Branch.id == branch_id).first():
        raise HTTPException(404, "Branch not found")


# ─── Payment webhook (public — verified by signature) ────────────────────────

@webhook_router.post("/{branch_id}", status_code=200)
async def payment_webhook(branch_id: str, request: Request, db: Session = Depends(get_db)):
    cfg = db.query(models.PaymentGatewayConfig).filter(
        models.PaymentGatewayConfig.branchId == branch_id,
        models.PaymentGatewayConfig.isActive == True,
    ).first()
    if not cfg:
        return JSONResponse({"detail": "Not configured"}, status_code=404)

    body_bytes = await request.body()

    # Verify webhook signature if webhookSecret is configured
    if cfg.webhookSecretEncrypted:
        from auth import decrypt_secret as _dec
        secret = _dec(cfg.webhookSecretEncrypted)
        if secret:
            provider = cfg.provider or "stripe"
            if provider == "stripe":
                sig_header = request.headers.get("stripe-signature", "")
                # Stripe signature: t=<timestamp>,v1=<hmac>
                try:
                    parts = {k: v for k, v in (p.split("=", 1) for p in sig_header.split(",") if "=" in p)}
                    ts = parts.get("t", "")
                    expected = hmac.new(secret.encode(), f"{ts}.".encode() + body_bytes, hashlib.sha256).hexdigest()
                    if not hmac.compare_digest(parts.get("v1", ""), expected):
                        return JSONResponse({"detail": "Invalid signature"}, status_code=401)
                except Exception:
                    return JSONResponse({"detail": "Signature verification failed"}, status_code=401)
            else:
                # Generic HMAC-SHA256
                expected = "sha256=" + hmac.new(secret.encode(), body_bytes, hashlib.sha256).hexdigest()
                sig = request.headers.get("x-payment-signature", "")
                if sig and not hmac.compare_digest(expected, sig):
                    return JSONResponse({"detail": "Invalid signature"}, status_code=401)

    try:
        payload = _json.loads(body_bytes)
    except Exception:
        payload = {}

    event_type = payload.get("type", payload.get("event", "unknown"))
    evt = models.WebhookEvent(
        id=generate_id(),
        branchId=branch_id,
        source="payment",
        eventType=str(event_type)[:50],
        payload=payload,
        processed=False,
    )
    db.add(evt)
    db.commit()
    return {"received": True}
