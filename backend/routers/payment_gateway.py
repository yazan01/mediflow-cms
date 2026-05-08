from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.orm import Session

from database import get_db
from auth import require_roles, generate_id, log_audit, encrypt_secret, decrypt_secret, mask_secret
import models

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
