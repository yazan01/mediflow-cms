from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_user, require_roles, generate_id, log_audit, sanitize_string
import models

CLINIC_ADMIN_ROLES = ("SUPER_ADMIN", "CLINIC_MANAGER")

router = APIRouter(tags=["clinics"])

VALID_CLINIC_TYPES = {"general", "dental", "radiology", "laboratory", "dermatology", "cardiology", "orthopedics", "pediatrics", "ophthalmology", "other"}
VALID_STATUSES = {"active", "inactive", "maintenance"}


class ClinicCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    code: str = Field(..., min_length=1, max_length=20)
    description: Optional[str] = None
    clinicType: Optional[str] = "general"
    colorTheme: Optional[str] = Field(None, max_length=20)
    capacity: Optional[int] = Field(10, ge=1, le=500)
    apptDurationMin: Optional[int] = Field(20, ge=5, le=180)
    queueEnabled: Optional[bool] = True
    onlineBooking: Optional[bool] = True
    sortOrder: Optional[int] = 0


class ClinicUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    code: Optional[str] = Field(None, max_length=20)
    description: Optional[str] = None
    clinicType: Optional[str] = None
    colorTheme: Optional[str] = Field(None, max_length=20)
    capacity: Optional[int] = Field(None, ge=1, le=500)
    apptDurationMin: Optional[int] = Field(None, ge=5, le=180)
    queueEnabled: Optional[bool] = None
    onlineBooking: Optional[bool] = None
    status: Optional[str] = None
    sortOrder: Optional[int] = None


def clinic_to_dict(c: models.Clinic) -> dict:
    return {
        "id": c.id,
        "branchId": c.branchId,
        "name": c.name,
        "code": c.code,
        "description": c.description or "",
        "clinicType": c.clinicType or "general",
        "colorTheme": c.colorTheme or "#1960a3",
        "capacity": c.capacity or 10,
        "apptDurationMin": c.apptDurationMin or 20,
        "queueEnabled": bool(c.queueEnabled),
        "onlineBooking": bool(c.onlineBooking),
        "status": c.status or "active",
        "sortOrder": c.sortOrder or 0,
        "createdAt": c.createdAt.isoformat() if c.createdAt else None,
    }


@router.get("/api/branches/{branch_id}/clinics")
def list_clinics(branch_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    branch = db.query(models.Branch).filter(models.Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(404, "Branch not found")
    clinics = (
        db.query(models.Clinic)
        .filter(models.Clinic.branchId == branch_id)
        .order_by(models.Clinic.sortOrder, models.Clinic.name)
        .all()
    )
    return [clinic_to_dict(c) for c in clinics]


@router.post("/api/branches/{branch_id}/clinics", status_code=201)
def create_clinic(
    branch_id: str,
    body: ClinicCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*CLINIC_ADMIN_ROLES)),
):
    branch = db.query(models.Branch).filter(models.Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(404, "Branch not found")

    if body.clinicType and body.clinicType not in VALID_CLINIC_TYPES:
        raise HTTPException(422, f"Invalid clinic type. Valid: {', '.join(sorted(VALID_CLINIC_TYPES))}")

    dup = db.query(models.Clinic).filter(
        models.Clinic.branchId == branch_id,
        models.Clinic.code == body.code.upper(),
    ).first()
    if dup:
        raise HTTPException(400, "Clinic code already exists in this branch")

    clinic = models.Clinic(
        id=generate_id(),
        branchId=branch_id,
        name=sanitize_string(body.name),
        code=body.code.upper(),
        description=sanitize_string(body.description),
        clinicType=body.clinicType or "general",
        colorTheme=body.colorTheme or "#1960a3",
        capacity=body.capacity or 10,
        apptDurationMin=body.apptDurationMin or 20,
        queueEnabled=body.queueEnabled,
        onlineBooking=body.onlineBooking,
        sortOrder=body.sortOrder or 0,
    )
    db.add(clinic)
    db.commit()
    db.refresh(clinic)
    log_audit(db, user.id, "CREATE", "Clinic", clinic.id, {"name": clinic.name, "branchId": branch_id})
    return clinic_to_dict(clinic)


@router.get("/api/clinics/{clinic_id}")
def get_clinic(clinic_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    clinic = db.query(models.Clinic).filter(models.Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(404, "Clinic not found")
    return clinic_to_dict(clinic)


@router.patch("/api/clinics/{clinic_id}")
def update_clinic(
    clinic_id: str,
    body: ClinicUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*CLINIC_ADMIN_ROLES)),
):
    clinic = db.query(models.Clinic).filter(models.Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(404, "Clinic not found")

    updates = body.model_dump(exclude_none=True)

    if "clinicType" in updates and updates["clinicType"] not in VALID_CLINIC_TYPES:
        raise HTTPException(422, f"Invalid clinic type")
    if "status" in updates and updates["status"] not in VALID_STATUSES:
        raise HTTPException(422, f"Invalid status. Valid: {', '.join(VALID_STATUSES)}")
    if "code" in updates:
        dup = db.query(models.Clinic).filter(
            models.Clinic.branchId == clinic.branchId,
            models.Clinic.code == updates["code"].upper(),
            models.Clinic.id != clinic_id,
        ).first()
        if dup:
            raise HTTPException(400, "Clinic code already exists in this branch")
        updates["code"] = updates["code"].upper()
    if "name" in updates:
        updates["name"] = sanitize_string(updates["name"])
    if "description" in updates:
        updates["description"] = sanitize_string(updates["description"])

    for field, val in updates.items():
        setattr(clinic, field, val)

    db.commit()
    db.refresh(clinic)
    log_audit(db, user.id, "UPDATE", "Clinic", clinic.id, {"name": clinic.name})
    return clinic_to_dict(clinic)


@router.delete("/api/clinics/{clinic_id}", status_code=204)
def deactivate_clinic(
    clinic_id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*CLINIC_ADMIN_ROLES)),
):
    clinic = db.query(models.Clinic).filter(models.Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(404, "Clinic not found")
    clinic.status = "inactive"
    db.commit()
    log_audit(db, user.id, "DELETE", "Clinic", clinic.id, {"name": clinic.name})
