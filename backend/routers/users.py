from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_user, generate_id, hash_password, generate_emp_code
import models

router = APIRouter(prefix="/api/users", tags=["users"])


class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    phone: Optional[str] = None
    roles: List[str]
    departmentId: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    roles: Optional[List[str]] = None
    departmentId: Optional[str] = None
    isActive: Optional[bool] = None


def user_to_dict(u: models.User) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "phone": u.phone,
        "photo": u.photo,
        "roles": u.roles or [],
        "isActive": u.isActive,
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
    _user=Depends(get_current_user),
):
    query = db.query(models.User)

    if search:
        query = query.filter(
            models.User.name.contains(search) | models.User.email.contains(search)
        )

    all_users = query.order_by(models.User.createdAt.desc()).all()

    if role and role != "ALL":
        all_users = [u for u in all_users if isinstance(u.roles, list) and role in u.roles]

    total = len(all_users)
    page_data = all_users[(page - 1) * pageSize: page * pageSize]

    return {
        "data": [user_to_dict(u) for u in page_data],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }


@router.post("", status_code=201)
def create_user(body: UserCreate, db: Session = Depends(get_db), _user=Depends(get_current_user)):
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
            empCode=generate_emp_code(),
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
    _user=Depends(get_current_user),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user_to_dict(user)


@router.delete("/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.isActive = False
    db.commit()
    return {"success": True}
