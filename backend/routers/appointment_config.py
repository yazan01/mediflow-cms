from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.orm import Session

from database import get_db
from auth import require_roles, generate_id, log_audit
import models

router = APIRouter(prefix="/api/settings/appointment-config", tags=["appointment-config"])

VALID_DAYS = {"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"}
APPT_ADMIN_ROLES = ("SUPER_ADMIN", "CLINIC_MANAGER")


class ApptConfigUpdate(BaseModel):
    workingDays: Optional[List[str]] = None
    startTime: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    endTime: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    slotDurationMin: Optional[int] = Field(None, ge=5, le=120)
    bufferMin: Optional[int] = Field(None, ge=0, le=60)
    maxDailyAppointments: Optional[int] = Field(None, ge=1, le=1000)
    bookingWindowDays: Optional[int] = Field(None, ge=1, le=365)
    autoConfirm: Optional[bool] = None


def _get_or_create(db: Session, branch_id: str) -> models.AppointmentConfig:
    cfg = db.query(models.AppointmentConfig).filter(models.AppointmentConfig.branchId == branch_id).first()
    if not cfg:
        cfg = models.AppointmentConfig(id=generate_id(), branchId=branch_id)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def cfg_to_dict(c: models.AppointmentConfig) -> dict:
    return {
        "branchId": c.branchId,
        "workingDays": c.workingDays or ["MON", "TUE", "WED", "THU", "FRI"],
        "startTime": c.startTime or "08:00",
        "endTime": c.endTime or "17:00",
        "slotDurationMin": c.slotDurationMin or 30,
        "bufferMin": c.bufferMin or 5,
        "maxDailyAppointments": c.maxDailyAppointments or 50,
        "bookingWindowDays": c.bookingWindowDays or 30,
        "autoConfirm": bool(c.autoConfirm),
        "updatedAt": c.updatedAt.isoformat() if c.updatedAt else None,
    }


@router.get("/{branch_id}")
def get_config(
    branch_id: str,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*APPT_ADMIN_ROLES)),
):
    _check_branch(branch_id, db)
    return cfg_to_dict(_get_or_create(db, branch_id))


@router.patch("/{branch_id}")
def update_config(
    branch_id: str,
    body: ApptConfigUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*APPT_ADMIN_ROLES)),
):
    _check_branch(branch_id, db)
    updates = body.model_dump(exclude_none=True)

    if "workingDays" in updates:
        invalid = [d for d in updates["workingDays"] if d not in VALID_DAYS]
        if invalid:
            raise HTTPException(422, f"Invalid days: {', '.join(invalid)}. Valid: {', '.join(sorted(VALID_DAYS))}")

    cfg = _get_or_create(db, branch_id)
    for field, val in updates.items():
        setattr(cfg, field, val)
    db.commit()
    db.refresh(cfg)
    log_audit(db, user.id, "UPDATE", "AppointmentConfig", cfg.id, {"branchId": branch_id})
    return cfg_to_dict(cfg)


def _check_branch(branch_id: str, db: Session):
    if not db.query(models.Branch).filter(models.Branch.id == branch_id).first():
        raise HTTPException(404, "Branch not found")
