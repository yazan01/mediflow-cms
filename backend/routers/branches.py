import zoneinfo
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_user, require_roles, generate_id, log_audit
import models

BRANCH_ADMIN_ROLES = ("SUPER_ADMIN", "CLINIC_MANAGER")

router = APIRouter(prefix="/api/branches", tags=["branches"])


# ─── Pydantic schemas ────────────────────────────────────────────────────────

class BranchCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    code: str = Field(..., min_length=1, max_length=20)
    description: Optional[str] = None
    country: Optional[str] = Field(None, max_length=50)
    city: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = None
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=200)
    managerId: Optional[str] = None
    timezone: Optional[str] = None


class BranchUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    code: Optional[str] = Field(None, max_length=20)
    description: Optional[str] = None
    country: Optional[str] = Field(None, max_length=50)
    city: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = None
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=200)
    managerId: Optional[str] = None
    timezone: Optional[str] = None
    isActive: Optional[bool] = None


class BranchSettingUpdate(BaseModel):
    currency: Optional[str] = Field(None, max_length=10)
    timezone: Optional[str] = Field(None, max_length=50)
    taxRate: Optional[float] = Field(None, ge=0, le=100)
    invoicePrefix: Optional[str] = Field(None, max_length=20)
    paymentTerms: Optional[int] = Field(None, ge=1, le=365)
    language: Optional[str] = Field(None, max_length=5)
    workingHoursStart: Optional[str] = Field(None, max_length=5)
    workingHoursEnd: Optional[str] = Field(None, max_length=5)
    workingDays: Optional[List[int]] = None
    emergencyContact: Optional[str] = Field(None, max_length=100)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def branch_to_dict(b: models.Branch, manager_name: Optional[str] = None) -> dict:
    return {
        "id": b.id,
        "name": b.name,
        "code": b.code,
        "description": b.description or "",
        "country": b.country or "",
        "city": b.city or "",
        "address": b.address or "",
        "phone": b.phone or "",
        "email": b.email or "",
        "managerId": b.managerId,
        "managerName": manager_name,
        "timezone": b.timezone or "",
        "isActive": b.isActive,
        "createdAt": b.createdAt.isoformat() if b.createdAt else None,
    }


def branch_setting_to_dict(bs: models.BranchSetting) -> dict:
    return {
        "currency": bs.currency or "USD",
        "timezone": bs.timezone or "Asia/Amman",
        "taxRate": float(bs.taxRate) if bs.taxRate is not None else 0.0,
        "invoicePrefix": bs.invoicePrefix or "INV",
        "paymentTerms": bs.paymentTerms or 30,
        "language": bs.language or "en",
        "workingHoursStart": bs.workingHoursStart or "08:00",
        "workingHoursEnd": bs.workingHoursEnd or "17:00",
        "workingDays": bs.workingDays if bs.workingDays is not None else [0, 1, 2, 3, 4],
        "emergencyContact": bs.emergencyContact or "",
    }


def _get_user_branch_ids(user: models.User, db: Session) -> Optional[List[str]]:
    """Returns None (= all branches) for super admins, or a list for scoped roles."""
    if "SUPER_ADMIN" in (user.roles or []):
        return None
    emp = db.query(models.Employee).filter(models.Employee.userId == user.id).first()
    if emp and emp.branchId:
        return [emp.branchId]
    return []


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("")
def list_branches(db: Session = Depends(get_db), user=Depends(get_current_user)):
    allowed = _get_user_branch_ids(user, db)
    q = db.query(models.Branch).order_by(models.Branch.name)
    if allowed is not None:
        q = q.filter(models.Branch.id.in_(allowed))
    branches = q.all()

    manager_ids = [b.managerId for b in branches if b.managerId]
    emp_map: dict = {}
    if manager_ids:
        emps = db.query(models.Employee).filter(models.Employee.id.in_(manager_ids)).all()
        user_ids = [e.userId for e in emps]
        users = db.query(models.User).filter(models.User.id.in_(user_ids)).all() if user_ids else []
        user_name_map = {u.id: u.name for u in users}
        emp_map = {e.id: user_name_map.get(e.userId) for e in emps}

    return [
        branch_to_dict(b, emp_map.get(b.managerId) if b.managerId else None)
        for b in branches
    ]


@router.post("", status_code=201)
def create_branch(
    body: BranchCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*BRANCH_ADMIN_ROLES)),
):
    existing = db.query(models.Branch).filter(models.Branch.code == body.code.upper()).first()
    if existing:
        raise HTTPException(400, "Branch code already exists")

    branch = models.Branch(
        id=generate_id(),
        name=body.name,
        code=body.code.upper(),
        description=body.description,
        country=body.country,
        city=body.city,
        address=body.address,
        phone=body.phone,
        email=body.email,
        managerId=body.managerId,
        timezone=body.timezone,
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)

    # Auto-create default branch settings
    db.add(models.BranchSetting(id=generate_id(), branchId=branch.id))
    db.commit()

    log_audit(db, user.id, "CREATE", "Branch", branch.id, {"name": branch.name})

    manager_name = None
    if branch.managerId:
        emp = db.query(models.Employee).filter(models.Employee.id == branch.managerId).first()
        if emp:
            u = db.query(models.User).filter(models.User.id == emp.userId).first()
            manager_name = u.name if u else None

    return branch_to_dict(branch, manager_name)


@router.get("/{branch_id}")
def get_branch(branch_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    branch = db.query(models.Branch).filter(models.Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(404, "Branch not found")
    allowed = _get_user_branch_ids(user, db)
    if allowed is not None and branch_id not in allowed:
        raise HTTPException(403, "Access restricted to your assigned branch")

    manager_name = None
    if branch.managerId:
        emp = db.query(models.Employee).filter(models.Employee.id == branch.managerId).first()
        if emp:
            u = db.query(models.User).filter(models.User.id == emp.userId).first()
            manager_name = u.name if u else None

    return branch_to_dict(branch, manager_name)


@router.patch("/{branch_id}")
def update_branch(
    branch_id: str,
    body: BranchUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*BRANCH_ADMIN_ROLES)),
):
    branch = db.query(models.Branch).filter(models.Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(404, "Branch not found")

    allowed = _get_user_branch_ids(user, db)
    if "SUPER_ADMIN" not in (user.roles or []) and allowed is not None and branch_id not in allowed:
        raise HTTPException(403, "You can only edit your own branch")

    if body.code:
        dup = db.query(models.Branch).filter(
            models.Branch.code == body.code.upper(),
            models.Branch.id != branch_id,
        ).first()
        if dup:
            raise HTTPException(400, "Branch code already exists")

    for field, val in body.model_dump(exclude_none=True).items():
        if field == "code":
            val = val.upper()
        setattr(branch, field, val)

    db.commit()
    db.refresh(branch)
    log_audit(db, user.id, "UPDATE", "Branch", branch.id, {"name": branch.name})

    manager_name = None
    if branch.managerId:
        emp = db.query(models.Employee).filter(models.Employee.id == branch.managerId).first()
        if emp:
            u = db.query(models.User).filter(models.User.id == emp.userId).first()
            manager_name = u.name if u else None

    return branch_to_dict(branch, manager_name)


# ─── Branch Settings ─────────────────────────────────────────────────────────

@router.get("/{branch_id}/settings")
def get_branch_settings(branch_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    branch = db.query(models.Branch).filter(models.Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(404, "Branch not found")
    allowed = _get_user_branch_ids(user, db)
    if allowed is not None and branch_id not in allowed:
        raise HTTPException(403, "Access restricted to your assigned branch")

    bs = db.query(models.BranchSetting).filter(models.BranchSetting.branchId == branch_id).first()
    if not bs:
        bs = models.BranchSetting(id=generate_id(), branchId=branch_id)
        db.add(bs)
        db.commit()
        db.refresh(bs)

    return branch_setting_to_dict(bs)


@router.patch("/{branch_id}/settings")
def update_branch_settings(
    branch_id: str,
    body: BranchSettingUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*BRANCH_ADMIN_ROLES)),
):
    branch = db.query(models.Branch).filter(models.Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(404, "Branch not found")

    allowed = _get_user_branch_ids(user, db)
    if "SUPER_ADMIN" not in (user.roles or []) and allowed is not None and branch_id not in allowed:
        raise HTTPException(403, "You can only edit your own branch settings")

    updates = body.model_dump(exclude_none=True)

    if "timezone" in updates and updates["timezone"]:
        try:
            zoneinfo.ZoneInfo(updates["timezone"])
        except (zoneinfo.ZoneInfoNotFoundError, KeyError):
            raise HTTPException(422, "Invalid timezone identifier")

    bs = db.query(models.BranchSetting).filter(models.BranchSetting.branchId == branch_id).first()
    if not bs:
        bs = models.BranchSetting(id=generate_id(), branchId=branch_id)
        db.add(bs)
        db.flush()

    old_dict = branch_setting_to_dict(bs)

    for field, val in updates.items():
        setattr(bs, field, val)

    db.commit()
    db.refresh(bs)

    ip = request.client.host if request.client else None
    from auth import generate_id as gid
    for field, new_val in updates.items():
        old_val = old_dict.get(field)
        if str(old_val) != str(new_val):
            db.add(models.SettingsHistory(
                id=gid(),
                scope="branch",
                scopeId=branch_id,
                changedBy=user.id,
                category="branch_settings",
                fieldName=field,
                oldValue=str(old_val),
                newValue=str(new_val),
                ipAddress=ip,
            ))
    db.commit()
    log_audit(db, user.id, "UPDATE", "BranchSetting", branch_id, new_values=updates)

    return branch_setting_to_dict(bs)


@router.get("/{branch_id}/settings/history")
def get_branch_settings_history(
    branch_id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*BRANCH_ADMIN_ROLES)),
):
    allowed = _get_user_branch_ids(user, db)
    if "SUPER_ADMIN" not in (user.roles or []) and allowed is not None and branch_id not in allowed:
        raise HTTPException(403, "Access restricted to your assigned branch")

    rows = (
        db.query(models.SettingsHistory)
        .filter(models.SettingsHistory.scope == "branch", models.SettingsHistory.scopeId == branch_id)
        .order_by(models.SettingsHistory.changedAt.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "id": r.id,
            "field": r.fieldName,
            "oldValue": r.oldValue,
            "newValue": r.newValue,
            "changedAt": r.changedAt.isoformat() if r.changedAt else None,
            "changedBy": r.changedBy,
        }
        for r in rows
    ]
