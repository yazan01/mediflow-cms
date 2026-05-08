import json as _json
import os
import time
import zoneinfo
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_user, require_roles, log_audit
import models

router = APIRouter(prefix="/api/settings", tags=["settings"])

_CACHE_TTL = 60  # seconds
_CACHE_KEY = "mediflow:settings"

# ─── Redis cache (distributed) with in-process fallback ──────────────────────
_redis_client = None
_redis_checked = False

def _get_redis():
    global _redis_client, _redis_checked
    if _redis_checked:
        return _redis_client
    _redis_checked = True
    url = os.getenv("REDIS_URL")
    if not url:
        return None
    try:
        import redis as _redis  # type: ignore
        client = _redis.from_url(url, decode_responses=True, socket_connect_timeout=2)
        client.ping()
        _redis_client = client
    except Exception:
        _redis_client = None
    return _redis_client

# In-process fallback
_cache: dict = {}
_cache_expires: float = 0.0


def _get_cached() -> Optional[dict]:
    r = _get_redis()
    if r:
        try:
            raw = r.get(_CACHE_KEY)
            if raw:
                return _json.loads(raw)
        except Exception:
            pass
        return None
    # In-process fallback
    if time.monotonic() < _cache_expires and _cache:
        return _cache
    return None


def _set_cached(data: dict):
    r = _get_redis()
    if r:
        try:
            r.setex(_CACHE_KEY, _CACHE_TTL, _json.dumps(data))
        except Exception:
            pass
        return
    global _cache, _cache_expires
    _cache = data
    _cache_expires = time.monotonic() + _CACHE_TTL


def _invalidate_cache():
    r = _get_redis()
    if r:
        try:
            r.delete(_CACHE_KEY)
        except Exception:
            pass
    global _cache, _cache_expires
    _cache = {}
    _cache_expires = 0.0


# ─── Pydantic schemas ────────────────────────────────────────────────────────

class SettingsUpdate(BaseModel):
    clinicName: Optional[str] = Field(None, max_length=255)
    licenseNumber: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = None
    taxId: Optional[str] = Field(None, max_length=100)
    currency: Optional[str] = Field(None, max_length=10)
    timezone: Optional[str] = Field(None, max_length=50)
    taxRate: Optional[float] = Field(None, ge=0, le=100)
    invoicePrefix: Optional[str] = Field(None, max_length=20)
    paymentTerms: Optional[int] = Field(None, ge=1, le=365)
    sessionTimeout: Optional[int] = Field(None, ge=5, le=480)
    passwordMinLength: Optional[int] = Field(None, ge=6, le=32)
    require2FA: Optional[bool] = None
    notifApptReminders: Optional[bool] = None
    notifLabCritical: Optional[bool] = None
    notifLowStock: Optional[bool] = None
    notifOverdueInvoice: Optional[bool] = None
    notifLeave: Optional[bool] = None


# ─── Helpers ─────────────────────────────────────────────────────────────────

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
        "notifApptReminders": bool(s.notifApptReminders) if s.notifApptReminders is not None else True,
        "notifLabCritical": bool(s.notifLabCritical) if s.notifLabCritical is not None else True,
        "notifLowStock": bool(s.notifLowStock) if s.notifLowStock is not None else True,
        "notifOverdueInvoice": bool(s.notifOverdueInvoice) if s.notifOverdueInvoice is not None else True,
        "notifLeave": bool(s.notifLeave) if s.notifLeave is not None else True,
    }


def get_or_create(db: Session) -> models.ClinicSetting:
    s = db.query(models.ClinicSetting).filter(models.ClinicSetting.id == 1).first()
    if not s:
        s = models.ClinicSetting(id=1)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


def _record_changes(db: Session, user_id: str, old: dict, new: dict, request: Request | None = None):
    ip = request.client.host if request and request.client else None
    from auth import generate_id
    for field, new_val in new.items():
        old_val = old.get(field)
        if str(old_val) != str(new_val):
            db.add(models.SettingsHistory(
                id=generate_id(),
                scope="global",
                scopeId=None,
                changedBy=user_id,
                category="general",
                fieldName=field,
                oldValue=str(old_val),
                newValue=str(new_val),
                ipAddress=ip,
            ))
    db.commit()


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("")
def get_settings(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    cached = _get_cached()
    if cached:
        return cached
    result = settings_to_dict(get_or_create(db))
    _set_cached(result)
    return result


@router.patch("")
def update_settings(
    body: SettingsUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(require_roles("SUPER_ADMIN")),
):
    s = db.query(models.ClinicSetting).filter(models.ClinicSetting.id == 1).with_for_update().first()
    if not s:
        s = models.ClinicSetting(id=1)
        db.add(s)
        db.flush()

    updates = body.model_dump(exclude_none=True)

    if "timezone" in updates and updates["timezone"]:
        try:
            zoneinfo.ZoneInfo(updates["timezone"])
        except (zoneinfo.ZoneInfoNotFoundError, KeyError):
            raise HTTPException(422, "Invalid timezone identifier")

    old_dict = settings_to_dict(s)

    for field, val in updates.items():
        setattr(s, field, val)

    db.commit()
    db.refresh(s)
    _invalidate_cache()

    new_dict = settings_to_dict(s)
    _record_changes(db, user.id, old_dict, updates, request)
    log_audit(db, user.id, "UPDATE", "Settings", "1", old_values=old_dict, new_values=new_dict)

    return new_dict


@router.get("/history")
def get_settings_history(
    db: Session = Depends(get_db),
    _user=Depends(require_roles("SUPER_ADMIN")),
):
    rows = (
        db.query(models.SettingsHistory)
        .filter(models.SettingsHistory.scope == "global")
        .order_by(models.SettingsHistory.changedAt.desc())
        .limit(200)
        .all()
    )
    return [
        {
            "id": r.id,
            "field": r.fieldName,
            "category": r.category,
            "oldValue": r.oldValue,
            "newValue": r.newValue,
            "changedAt": r.changedAt.isoformat() if r.changedAt else None,
            "changedBy": r.changedBy,
            "ipAddress": r.ipAddress,
        }
        for r in rows
    ]
