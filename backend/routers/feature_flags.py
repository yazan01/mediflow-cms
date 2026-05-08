from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.orm import Session

from database import get_db
from auth import require_roles, generate_id, log_audit
import models

router = APIRouter(prefix="/api/settings/features", tags=["feature-flags"])

DEFAULT_FLAGS = [
    {"key": "whatsapp_integration",     "description": "Enable WhatsApp Business API per-branch messaging"},
    {"key": "sms_notifications",        "description": "Enable SMS gateway for appointment reminders"},
    {"key": "online_booking",           "description": "Allow patients to book appointments online"},
    {"key": "payment_gateway",          "description": "Enable online payment collection"},
    {"key": "ai_chatbot",               "description": "Enable AI-powered chatbot responses on WhatsApp"},
    {"key": "lab_portal",               "description": "Enable online lab results portal for patients"},
    {"key": "radiology_portal",         "description": "Enable PACS/radiology image portal"},
    {"key": "multi_branch_reports",     "description": "Show consolidated cross-branch analytics"},
    {"key": "patient_portal",           "description": "Enable patient self-service portal"},
    {"key": "electronic_prescriptions", "description": "Enable digital prescription signing"},
]


class FlagUpdate(BaseModel):
    isEnabled: bool
    description: Optional[str] = None


def _seed_globals(db: Session):
    """Seed global (branchId=None) defaults if they don't exist."""
    for flag in DEFAULT_FLAGS:
        exists = (
            db.query(models.FeatureFlag)
            .filter(models.FeatureFlag.key == flag["key"], models.FeatureFlag.branchId.is_(None))
            .first()
        )
        if not exists:
            db.add(models.FeatureFlag(
                id=generate_id(),
                key=flag["key"],
                branchId=None,
                description=flag["description"],
                isEnabled=False,
            ))
    db.commit()


def flag_to_dict(f: models.FeatureFlag) -> dict:
    return {
        "id": f.id,
        "key": f.key,
        "branchId": f.branchId,
        "description": f.description or "",
        "isEnabled": bool(f.isEnabled),
        "updatedAt": f.updatedAt.isoformat() if f.updatedAt else None,
        "updatedBy": f.updatedBy,
    }


@router.get("")
def list_flags(
    branch_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("SUPER_ADMIN", "CLINIC_MANAGER")),
):
    _seed_globals(db)
    if branch_id:
        # Validate branch exists
        if not db.query(models.Branch).filter(models.Branch.id == branch_id).first():
            raise HTTPException(404, "Branch not found")
        # Return global flags merged with branch overrides
        globals_map = {
            f.key: f
            for f in db.query(models.FeatureFlag)
            .filter(models.FeatureFlag.branchId.is_(None))
            .all()
        }
        branch_map = {
            f.key: f
            for f in db.query(models.FeatureFlag)
            .filter(models.FeatureFlag.branchId == branch_id)
            .all()
        }
        merged = {**globals_map, **branch_map}
        return [flag_to_dict(f) for f in sorted(merged.values(), key=lambda x: x.key)]
    # Global flags only
    flags = db.query(models.FeatureFlag).filter(models.FeatureFlag.branchId.is_(None)).order_by(models.FeatureFlag.key).all()
    return [flag_to_dict(f) for f in flags]


@router.patch("/{key}")
def toggle_flag(
    key: str,
    body: FlagUpdate,
    branch_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user=Depends(require_roles("SUPER_ADMIN", "CLINIC_MANAGER")),
):
    _seed_globals(db)

    if branch_id:
        if not db.query(models.Branch).filter(models.Branch.id == branch_id).first():
            raise HTTPException(404, "Branch not found")
        # Upsert a per-branch override
        flag = (
            db.query(models.FeatureFlag)
            .filter(models.FeatureFlag.key == key, models.FeatureFlag.branchId == branch_id)
            .first()
        )
        if not flag:
            flag = models.FeatureFlag(
                id=generate_id(),
                key=key,
                branchId=branch_id,
                description=body.description,
                isEnabled=body.isEnabled,
                updatedBy=user.id,
            )
            db.add(flag)
        else:
            flag.isEnabled = body.isEnabled
            flag.updatedBy = user.id
            if body.description is not None:
                flag.description = body.description
        db.commit()
        db.refresh(flag)
        log_audit(db, user.id, "UPDATE", "FeatureFlag", flag.id, {"key": key, "branchId": branch_id, "to": body.isEnabled})
        return flag_to_dict(flag)

    # Update global flag (SUPER_ADMIN only for global changes)
    if not any(r == "SUPER_ADMIN" for r in (user.roles if isinstance(user.roles, list) else [])):
        raise HTTPException(403, "Only SUPER_ADMIN can change global feature flags")

    flag = (
        db.query(models.FeatureFlag)
        .filter(models.FeatureFlag.key == key, models.FeatureFlag.branchId.is_(None))
        .first()
    )
    if not flag:
        raise HTTPException(404, "Feature flag not found")

    old = flag.isEnabled
    flag.isEnabled = body.isEnabled
    flag.updatedBy = user.id
    if body.description is not None:
        flag.description = body.description
    db.commit()
    db.refresh(flag)

    log_audit(db, user.id, "UPDATE", "FeatureFlag", flag.id, {"key": key, "from": old, "to": body.isEnabled})
    return flag_to_dict(flag)
