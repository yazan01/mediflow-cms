from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_user, require_roles, generate_id, log_audit

BRANCH_ADMIN_ROLES = ("SUPER_ADMIN", "CLINIC_MANAGER")
import models

router = APIRouter(prefix="/api/branches", tags=["branches"])


class BranchCreate(BaseModel):
    name: str
    code: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    managerId: Optional[str] = None
    timezone: Optional[str] = None


class BranchUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    managerId: Optional[str] = None
    timezone: Optional[str] = None
    isActive: Optional[bool] = None


def branch_to_dict(b: models.Branch, db: Session) -> dict:
    manager_name = None
    if b.managerId:
        emp = db.query(models.Employee).filter(models.Employee.id == b.managerId).first()
        if emp:
            user = db.query(models.User).filter(models.User.id == emp.userId).first()
            if user:
                manager_name = user.name
    return {
        "id": b.id,
        "name": b.name,
        "code": b.code,
        "address": b.address or "",
        "phone": b.phone or "",
        "email": b.email or "",
        "managerId": b.managerId,
        "managerName": manager_name,
        "timezone": b.timezone or "",
        "isActive": b.isActive,
        "createdAt": b.createdAt.isoformat() if b.createdAt else None,
    }


@router.get("")
def list_branches(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    branches = db.query(models.Branch).order_by(models.Branch.name).all()

    # Batch-load managers to avoid N+1
    manager_ids = [b.managerId for b in branches if b.managerId]
    emp_map: dict = {}
    if manager_ids:
        emps = db.query(models.Employee).filter(models.Employee.id.in_(manager_ids)).all()
        user_ids = [e.userId for e in emps]
        users = db.query(models.User).filter(models.User.id.in_(user_ids)).all() if user_ids else []
        user_name_map = {u.id: u.name for u in users}
        emp_map = {e.id: user_name_map.get(e.userId) for e in emps}

    return [
        {
            "id": b.id,
            "name": b.name,
            "code": b.code,
            "address": b.address or "",
            "phone": b.phone or "",
            "email": b.email or "",
            "managerId": b.managerId,
            "managerName": emp_map.get(b.managerId) if b.managerId else None,
            "timezone": b.timezone or "",
            "isActive": b.isActive,
            "createdAt": b.createdAt.isoformat() if b.createdAt else None,
        }
        for b in branches
    ]


@router.post("", status_code=201)
def create_branch(body: BranchCreate, db: Session = Depends(get_db), user=Depends(require_roles(*BRANCH_ADMIN_ROLES))):
    existing = db.query(models.Branch).filter(models.Branch.code == body.code.upper()).first()
    if existing:
        raise HTTPException(400, "Branch code already exists")
    branch = models.Branch(
        id=generate_id(),
        name=body.name,
        code=body.code.upper(),
        address=body.address,
        phone=body.phone,
        email=body.email,
        managerId=body.managerId,
        timezone=body.timezone,
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)
    log_audit(db, user.id, "CREATE", "Branch", branch.id, {"name": branch.name})
    return branch_to_dict(branch, db)


@router.get("/{branch_id}")
def get_branch(branch_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    branch = db.query(models.Branch).filter(models.Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(404, "Branch not found")
    return branch_to_dict(branch, db)


@router.patch("/{branch_id}")
def update_branch(branch_id: str, body: BranchUpdate, db: Session = Depends(get_db), user=Depends(require_roles(*BRANCH_ADMIN_ROLES))):
    branch = db.query(models.Branch).filter(models.Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(404, "Branch not found")
    if body.code:
        dup = db.query(models.Branch).filter(models.Branch.code == body.code.upper(), models.Branch.id != branch_id).first()
        if dup:
            raise HTTPException(400, "Branch code already exists")
    for field, val in body.model_dump(exclude_none=True).items():
        if field == "code":
            val = val.upper()
        setattr(branch, field, val)
    db.commit()
    db.refresh(branch)
    log_audit(db, user.id, "UPDATE", "Branch", branch.id, {"name": branch.name})
    return branch_to_dict(branch, db)
