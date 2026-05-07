import json
import re
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from auth import get_current_user, require_roles, generate_id, hash_password, generate_emp_code

ADMIN_ROLES = ("SUPER_ADMIN", "CLINIC_MANAGER")
VALID_ROLES = {
    "SUPER_ADMIN", "CLINIC_MANAGER", "DOCTOR", "NURSE", "RECEPTIONIST",
    "PHARMACIST", "LAB_TECHNICIAN", "RADIOLOGIST", "ACCOUNTANT", "HR_OFFICER", "AUDITOR", "STAFF",
}
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
import models


def parse_roles(raw) -> list:
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except Exception:
            return []
    return []

router = APIRouter(prefix="/api/users", tags=["users"])


class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    phone: Optional[str] = Field(None, max_length=30)
    roles: List[str] = Field(..., min_length=1)
    departmentId: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("Invalid email address")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, v: List[str]) -> List[str]:
        invalid = [r for r in v if r not in VALID_ROLES]
        if invalid:
            raise ValueError(f"Invalid roles: {invalid}")
        return v


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    phone: Optional[str] = Field(None, max_length=30)
    roles: Optional[List[str]] = None
    departmentId: Optional[str] = None
    isActive: Optional[bool] = None

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        invalid = [r for r in v if r not in VALID_ROLES]
        if invalid:
            raise ValueError(f"Invalid roles: {invalid}")
        return v


def user_to_dict(u: models.User) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "phone": u.phone,
        "photo": u.photo,
        "roles": parse_roles(u.roles),
        "isActive": u.isActive,
        "twoFAEnabled": bool(u.twoFAEnabled),
        "lastLogin": u.lastLogin.isoformat() if u.lastLogin else None,
        "createdAt": u.createdAt.isoformat() if u.createdAt else None,
        "department": {"id": u.department.id, "name": u.department.name} if u.department else None,
    }


@router.get("")
def get_users(
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    search: str = Query(""),
    role: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*ADMIN_ROLES)),
):
    query = db.query(models.User)

    if search:
        query = query.filter(
            models.User.name.contains(search) | models.User.email.contains(search)
        )

    # Push JSON role filtering to MySQL using JSON_CONTAINS — avoids loading entire table
    if role and role != "ALL":
        query = query.filter(
            func.json_contains(models.User.roles, func.json_quote(role)) == 1
        )

    total = query.count()
    page_data = (
        query.order_by(models.User.createdAt.desc())
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .all()
    )

    return {
        "data": [user_to_dict(u) for u in page_data],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }


@router.post("", status_code=201)
def create_user(body: UserCreate, db: Session = Depends(get_db), _user=Depends(require_roles(*ADMIN_ROLES))):
    if not all([body.name, body.email, body.password]) or not body.roles:
        raise HTTPException(status_code=400, detail="Name, email, password, and at least one role are required")

    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    existing = db.query(models.User).filter(models.User.email == body.email.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="A user with this email already exists")

    user = models.User(
        id=generate_id(),
        name=body.name,
        email=body.email.lower(),
        phone=body.phone,
        roles=body.roles,
        passwordHash=hash_password(body.password),
        departmentId=body.departmentId,
        isActive=True,
    )
    db.add(user)
    db.flush()

    STAFF_ROLES = {"DOCTOR", "NURSE", "RECEPTIONIST", "PHARMACIST", "LAB_TECHNICIAN", "RADIOLOGIST", "ACCOUNTANT", "HR_OFFICER"}
    if any(r in STAFF_ROLES for r in body.roles) and body.departmentId:
        from datetime import datetime
        db.add(models.Employee(
            id=generate_id(),
            empCode=generate_emp_code(db),
            userId=user.id,
            departmentId=body.departmentId,
            jobTitle=body.roles[0],
            basicSalary=0,
            hireDate=datetime.now(),
        ))

    db.commit()
    db.refresh(user)
    return user_to_dict(user)


@router.patch("/{user_id}")
def update_user(
    user_id: str,
    body: UserUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*ADMIN_ROLES)),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    updates = body.model_dump(exclude_none=True)
    if "roles" in updates and user_id == _user.id:
        raise HTTPException(status_code=403, detail="Cannot modify your own roles")

    for field, value in updates.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user_to_dict(user)


@router.delete("/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db), _user=Depends(require_roles(*ADMIN_ROLES))):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.isActive = False
    db.commit()
    return {"success": True}
