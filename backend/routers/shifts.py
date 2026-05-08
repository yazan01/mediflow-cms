from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import datetime

from database import get_db
from auth import get_current_user, require_roles, generate_id, log_audit

SHIFT_ADMIN_ROLES = ("SUPER_ADMIN", "CLINIC_MANAGER", "HR_OFFICER")
import models

router = APIRouter(prefix="/api/shifts", tags=["shifts"])

DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


class ShiftCreate(BaseModel):
    name: str
    startTime: str          # "08:00"
    endTime: str            # "16:00"
    daysOfWeek: List[int]   # [0,1,2,3,4]
    branchId: Optional[str] = None
    color: Optional[str] = "#1960a3"


class ShiftUpdate(BaseModel):
    name: Optional[str] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    daysOfWeek: Optional[List[int]] = None
    branchId: Optional[str] = None
    color: Optional[str] = None
    isActive: Optional[bool] = None


class AssignmentCreate(BaseModel):
    employeeId: str
    shiftId: str
    startDate: str          # ISO date string
    endDate: Optional[str] = None
    notes: Optional[str] = None


def shift_to_dict(s: models.Shift, db: Session = None) -> dict:
    # Uses pre-loaded branch relationship if available (avoids N+1 on list endpoints)
    branch_name = s.branch.name if s.branch else None
    days = s.daysOfWeek or []
    return {
        "id": s.id,
        "name": s.name,
        "startTime": s.startTime,
        "endTime": s.endTime,
        "daysOfWeek": days,
        "dayNames": [DAY_NAMES[d] for d in days if 0 <= d <= 6],
        "branchId": s.branchId,
        "branchName": branch_name,
        "color": s.color or "#1960a3",
        "isActive": s.isActive,
        "assignmentCount": len(s.assignments),
        "createdAt": s.createdAt.isoformat() if s.createdAt else None,
    }


def assignment_to_dict(a: models.ShiftAssignment, db: Session = None) -> dict:
    # Uses pre-loaded relationships if available (avoids N+1 on list endpoints)
    emp_name = a.employee.user.name if a.employee and a.employee.user else None
    job_title = a.employee.jobTitle if a.employee else None
    return {
        "id": a.id,
        "employeeId": a.employeeId,
        "employeeName": emp_name,
        "jobTitle": job_title,
        "shiftId": a.shiftId,
        "shiftName": a.shift.name if a.shift else None,
        "startDate": a.startDate.isoformat() if a.startDate else None,
        "endDate": a.endDate.isoformat() if a.endDate else None,
        "notes": a.notes or "",
    }


# ─── Shifts CRUD ──────────────────────────────────────────────────────────────

@router.get("")
def list_shifts(branch_id: Optional[str] = None, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    q = db.query(models.Shift).options(joinedload(models.Shift.branch))
    if branch_id:
        q = q.filter(models.Shift.branchId == branch_id)
    return [shift_to_dict(s) for s in q.order_by(models.Shift.name).all()]


@router.post("", status_code=201)
def create_shift(body: ShiftCreate, db: Session = Depends(get_db), user=Depends(require_roles(*SHIFT_ADMIN_ROLES))):
    shift = models.Shift(
        id=generate_id(),
        name=body.name,
        startTime=body.startTime,
        endTime=body.endTime,
        daysOfWeek=body.daysOfWeek,
        branchId=body.branchId,
        color=body.color or "#1960a3",
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    log_audit(db, user.id, "CREATE", "Shift", shift.id, {"name": shift.name})
    return shift_to_dict(shift)


@router.patch("/{shift_id}")
def update_shift(shift_id: str, body: ShiftUpdate, db: Session = Depends(get_db), user=Depends(require_roles(*SHIFT_ADMIN_ROLES))):
    shift = db.query(models.Shift).filter(models.Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(404, "Shift not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(shift, field, val)
    db.commit()
    db.refresh(shift)
    log_audit(db, user.id, "UPDATE", "Shift", shift.id, {"name": shift.name})
    return shift_to_dict(shift)


@router.delete("/{shift_id}", status_code=204)
def delete_shift(shift_id: str, db: Session = Depends(get_db), user=Depends(require_roles(*SHIFT_ADMIN_ROLES))):
    shift = db.query(models.Shift).filter(models.Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(404, "Shift not found")
    # L-005: Block deletion if active assignments exist
    active_count = db.query(func.count(models.ShiftAssignment.id)).filter(
        models.ShiftAssignment.shiftId == shift_id,
        (models.ShiftAssignment.endDate == None) | (models.ShiftAssignment.endDate >= datetime.now()),
    ).scalar() or 0
    if active_count > 0:
        raise HTTPException(
            409,
            f"Cannot delete shift with {active_count} active assignment(s). Remove all assignments first.",
        )
    shift.isActive = False
    db.commit()
    log_audit(db, user.id, "DELETE", "Shift", shift_id, {})


# ─── Assignments ─────────────────────────────────────────────────────────────

@router.get("/{shift_id}/assignments")
def list_assignments(shift_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    assignments = (
        db.query(models.ShiftAssignment)
        .filter(models.ShiftAssignment.shiftId == shift_id)
        .options(
            joinedload(models.ShiftAssignment.employee).joinedload(models.Employee.user),
            joinedload(models.ShiftAssignment.shift),
        )
        .all()
    )
    return [assignment_to_dict(a) for a in assignments]


@router.post("/assignments", status_code=201)
def create_assignment(body: AssignmentCreate, db: Session = Depends(get_db), user=Depends(require_roles(*SHIFT_ADMIN_ROLES))):
    assignment = models.ShiftAssignment(
        id=generate_id(),
        employeeId=body.employeeId,
        shiftId=body.shiftId,
        startDate=datetime.fromisoformat(body.startDate),
        endDate=datetime.fromisoformat(body.endDate) if body.endDate else None,
        notes=body.notes,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    log_audit(db, user.id, "CREATE", "ShiftAssignment", assignment.id, {"employeeId": body.employeeId, "shiftId": body.shiftId})
    return assignment_to_dict(assignment)


@router.delete("/assignments/{assignment_id}", status_code=204)
def delete_assignment(assignment_id: str, db: Session = Depends(get_db), user=Depends(require_roles(*SHIFT_ADMIN_ROLES))):
    a = db.query(models.ShiftAssignment).filter(models.ShiftAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(404, "Assignment not found")
    db.delete(a)
    db.commit()
    log_audit(db, user.id, "DELETE", "ShiftAssignment", assignment_id, {})
