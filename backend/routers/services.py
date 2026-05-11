from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_user, require_roles, generate_id, log_audit
import models

router = APIRouter(prefix="/api/services", tags=["services"])

SERVICE_ROLES = ("SUPER_ADMIN", "CLINIC_MANAGER", "ACCOUNTANT", "RECEPTIONIST")

VALID_CATEGORIES = {
    "Consultation", "Procedure", "Lab", "Radiology", "Medication", "Other",
}


class ServiceIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    category: str = Field("Consultation", max_length=100)
    defaultPrice: float = Field(..., ge=0)
    description: Optional[str] = Field(None, max_length=1000)
    isActive: bool = True
    branchId: Optional[str] = None


class ServiceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[str] = Field(None, max_length=100)
    defaultPrice: Optional[float] = Field(None, ge=0)
    description: Optional[str] = Field(None, max_length=1000)
    isActive: Optional[bool] = None
    branchId: Optional[str] = None


def service_to_dict(s: models.Service) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "category": s.category,
        "defaultPrice": float(s.defaultPrice),
        "description": s.description,
        "isActive": s.isActive,
        "branchId": s.branchId,
        "branchName": s.branch.name if s.branch else None,
        "createdAt": s.createdAt.isoformat() if s.createdAt else None,
        "updatedAt": s.updatedAt.isoformat() if s.updatedAt else None,
    }


@router.get("")
def list_services(
    branchId: Optional[str] = None,
    search: str = Query(""),
    isActive: Optional[bool] = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    q = db.query(models.Service)

    # branch filter: return branch-specific + global (null branchId) services
    if branchId:
        q = q.filter(
            (models.Service.branchId == branchId) | (models.Service.branchId == None)  # noqa: E711
        )

    if search:
        q = q.filter(models.Service.name.contains(search))

    if isActive is not None:
        q = q.filter(models.Service.isActive == isActive)

    services = q.order_by(models.Service.category, models.Service.name).all()
    return [service_to_dict(s) for s in services]


@router.post("", status_code=201)
def create_service(
    body: ServiceIn,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*SERVICE_ROLES)),
):
    if body.category not in VALID_CATEGORIES:
        raise HTTPException(422, f"Invalid category. Allowed: {', '.join(sorted(VALID_CATEGORIES))}")

    if body.branchId:
        branch = db.query(models.Branch).filter(models.Branch.id == body.branchId).first()
        if not branch:
            raise HTTPException(404, "Branch not found")

    svc = models.Service(
        id=generate_id(),
        name=body.name.strip(),
        category=body.category,
        defaultPrice=body.defaultPrice,
        description=body.description,
        isActive=body.isActive,
        branchId=body.branchId or None,
    )
    db.add(svc)
    db.commit()
    db.refresh(svc)
    log_audit(db, current_user.id, "CREATE", "SERVICES", svc.id, "Service",
              new_values={"name": svc.name, "defaultPrice": float(svc.defaultPrice)})
    return service_to_dict(svc)


@router.patch("/{service_id}")
def update_service(
    service_id: str,
    body: ServiceUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*SERVICE_ROLES)),
):
    svc = db.query(models.Service).filter(models.Service.id == service_id).first()
    if not svc:
        raise HTTPException(404, "Service not found")

    updates = body.model_dump(exclude_none=True)

    if "category" in updates and updates["category"] not in VALID_CATEGORIES:
        raise HTTPException(422, f"Invalid category. Allowed: {', '.join(sorted(VALID_CATEGORIES))}")

    if "branchId" in updates and updates["branchId"]:
        branch = db.query(models.Branch).filter(models.Branch.id == updates["branchId"]).first()
        if not branch:
            raise HTTPException(404, "Branch not found")

    old = {"name": svc.name, "defaultPrice": float(svc.defaultPrice)}
    for field, val in updates.items():
        setattr(svc, field, val)

    db.commit()
    db.refresh(svc)
    log_audit(db, current_user.id, "UPDATE", "SERVICES", svc.id, "Service",
              old_values=old, new_values=updates)
    return service_to_dict(svc)


@router.delete("/{service_id}", status_code=204)
def delete_service(
    service_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*SERVICE_ROLES)),
):
    svc = db.query(models.Service).filter(models.Service.id == service_id).first()
    if not svc:
        raise HTTPException(404, "Service not found")

    log_audit(db, current_user.id, "DELETE", "SERVICES", svc.id, "Service",
              old_values={"name": svc.name})
    db.delete(svc)
    db.commit()
