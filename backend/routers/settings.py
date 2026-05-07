from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_user, require_roles
import models

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    clinicName: Optional[str] = None
    licenseNumber: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    taxId: Optional[str] = None
    currency: Optional[str] = None
    timezone: Optional[str] = None
    taxRate: Optional[float] = None
    invoicePrefix: Optional[str] = None
    paymentTerms: Optional[int] = None
    sessionTimeout: Optional[int] = None
    passwordMinLength: Optional[int] = None
    require2FA: Optional[bool] = None


def settings_to_dict(s: models.ClinicSetting) -> dict:
    return {
        "clinicName": s.clinicName or "",
        "licenseNumber": s.licenseNumber or "",
        "phone": s.phone or "",
        "email": s.email or "",
        "address": s.address or "",
        "taxId": s.taxId or "",
        "currency": s.currency or "USD",
        "timezone": s.timezone or "Asia/Amman",
        "taxRate": float(s.taxRate) if s.taxRate is not None else 7.0,
        "invoicePrefix": s.invoicePrefix or "INV",
        "paymentTerms": s.paymentTerms or 30,
        "sessionTimeout": s.sessionTimeout or 480,
        "passwordMinLength": s.passwordMinLength or 8,
        "require2FA": bool(s.require2FA),
    }


def get_or_create(db: Session) -> models.ClinicSetting:
    s = db.query(models.ClinicSetting).filter(models.ClinicSetting.id == 1).first()
    if not s:
        s = models.ClinicSetting(id=1)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


@router.get("")
def get_settings(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return settings_to_dict(get_or_create(db))


@router.patch("")
def update_settings(
    body: SettingsUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("SUPER_ADMIN", "CLINIC_MANAGER")),
):
    s = get_or_create(db)
    updates = body.model_dump(exclude_none=True)
    if "timezone" in updates and updates["timezone"]:
        import zoneinfo
        try:
            zoneinfo.ZoneInfo(updates["timezone"])
        except (zoneinfo.ZoneInfoNotFoundError, KeyError):
            raise HTTPException(422, f"Invalid timezone: {updates['timezone']!r}")
    for field, val in updates.items():
        setattr(s, field, val)
    db.commit()
    db.refresh(s)
    return settings_to_dict(s)
