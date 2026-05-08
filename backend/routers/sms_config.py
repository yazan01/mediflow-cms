from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.orm import Session

from database import get_db
from auth import require_roles, generate_id, log_audit, encrypt_secret, decrypt_secret, mask_secret
import models

router = APIRouter(prefix="/api/settings/sms", tags=["sms"])
SMS_ADMIN_ROLES = ("SUPER_ADMIN", "CLINIC_MANAGER")
VALID_PROVIDERS = {"twilio", "vonage", "aws_sns", "infobip", "custom"}


class SmsUpdate(BaseModel):
    provider: Optional[str] = Field(None, max_length=30)
    apiKey: Optional[str] = None
    apiSecret: Optional[str] = None
    fromNumber: Optional[str] = Field(None, max_length=20)
    isActive: Optional[bool] = None
    dailyLimit: Optional[int] = Field(None, ge=1, le=100000)


def _get_or_create(db: Session, branch_id: Optional[str] = None) -> models.SmsConfig:
    q = db.query(models.SmsConfig).filter(models.SmsConfig.branchId == branch_id)
    cfg = q.first()
    if not cfg:
        cfg = models.SmsConfig(id=generate_id(), branchId=branch_id)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def sms_to_dict(c: models.SmsConfig) -> dict:
    return {
        "branchId": c.branchId,
        "provider": c.provider or "twilio",
        "apiKeyMasked": mask_secret(decrypt_secret(c.apiKeyEncrypted or "")),
        "apiSecretMasked": mask_secret(decrypt_secret(c.apiSecretEncrypted or "")),
        "fromNumber": c.fromNumber or "",
        "isActive": bool(c.isActive),
        "dailyLimit": c.dailyLimit or 1000,
    }


@router.get("")
def get_global_sms(db: Session = Depends(get_db), _user=Depends(require_roles(*SMS_ADMIN_ROLES))):
    return sms_to_dict(_get_or_create(db, None))


@router.patch("")
def update_global_sms(body: SmsUpdate, db: Session = Depends(get_db), user=Depends(require_roles(*SMS_ADMIN_ROLES))):
    return _update(None, body, db, user)


@router.get("/{branch_id}")
def get_branch_sms(branch_id: str, db: Session = Depends(get_db), _user=Depends(require_roles(*SMS_ADMIN_ROLES))):
    _ensure_branch(branch_id, db)
    return sms_to_dict(_get_or_create(db, branch_id))


@router.patch("/{branch_id}")
def update_branch_sms(
    branch_id: str, body: SmsUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*SMS_ADMIN_ROLES)),
):
    _ensure_branch(branch_id, db)
    return _update(branch_id, body, db, user)


def _update(branch_id, body: SmsUpdate, db: Session, user):
    if body.provider and body.provider not in VALID_PROVIDERS:
        raise HTTPException(422, f"Invalid provider. Valid: {', '.join(sorted(VALID_PROVIDERS))}")
    cfg = _get_or_create(db, branch_id)
    updates = body.model_dump(exclude_none=True)
    if "apiKey" in updates:
        cfg.apiKeyEncrypted = encrypt_secret(updates.pop("apiKey"))
    if "apiSecret" in updates:
        cfg.apiSecretEncrypted = encrypt_secret(updates.pop("apiSecret"))
    for field, val in updates.items():
        setattr(cfg, field, val)
    db.commit()
    db.refresh(cfg)
    log_audit(db, user.id, "UPDATE", "SmsConfig", cfg.id, {"branchId": branch_id})
    return sms_to_dict(cfg)


def _ensure_branch(branch_id: str, db: Session):
    if not db.query(models.Branch).filter(models.Branch.id == branch_id).first():
        raise HTTPException(404, "Branch not found")
