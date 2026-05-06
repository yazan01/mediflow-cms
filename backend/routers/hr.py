from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import and_

from database import get_db
from auth import get_current_user, generate_id
import models

router = APIRouter(prefix="/api/hr", tags=["hr"])


class LeaveCreate(BaseModel):
    employeeId: str
    type: str
    startDate: str
    endDate: str
    days: int
    reason: Optional[str] = None


class PayrollCreate(BaseModel):
    employeeId: str
    month: int
    year: int
    basicSalary: float
    allowances: Optional[float] = 0
    bonus: Optional[float] = 0
    overtimePay: Optional[float] = 0
    deductions: Optional[float] = 0
    taxDeduction: Optional[float] = 0
    notes: Optional[str] = None


class AttendanceCreate(BaseModel):
    employeeId: str
    date: str
    checkIn: Optional[str] = None
    checkOut: Optional[str] = None
    status: Optional[str] = "PRESENT"
    overtimeHrs: Optional[float] = None
    notes: Optional[str] = None
    isManual: Optional[bool] = True


def employee_to_dict(e: models.Employee) -> dict:
    return {
        "id": e.id,
        "empCode": e.empCode,
        "userId": e.userId,
        "jobTitle": e.jobTitle,
        "employmentType": e.employmentType,
        "status": e.status,
        "basicSalary": float(e.basicSalary),
        "housingAllowance": float(e.housingAllowance or 0),
        "transportAllowance": float(e.transportAllowance or 0),
        "medicalAllowance": float(e.medicalAllowance or 0),
        "hireDate": e.hireDate.isoformat() if e.hireDate else None,
        "annualLeaveBalance": e.annualLeaveBalance,
        "sickLeaveBalance": e.sickLeaveBalance,
        "user": {
            "name": e.user.name if e.user else "",
            "email": e.user.email if e.user else "",
            "phone": e.user.phone if e.user else None,
            "photo": e.user.photo if e.user else None,
            "isActive": e.user.isActive if e.user else True,
        },
        "department": {
            "id": e.department.id if e.department else None,
            "name": e.department.name if e.department else "",
        },
        "createdAt": e.createdAt.isoformat() if e.createdAt else None,
    }


# ── Employees ──────────────────────────────────────────────────────────────────

@router.get("/employees")
def get_employees(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    status: Optional[str] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = db.query(models.Employee)

    if search:
        query = query.join(models.User).filter(
            models.User.name.contains(search) | models.User.email.contains(search)
        )

    if status and status != "ALL":
        query = query.filter(models.Employee.status == status)

    if department and department != "ALL":
        query = query.filter(models.Employee.departmentId == department)

    total = query.count()
    employees = query.order_by(models.Employee.empCode.asc()).offset((page - 1) * pageSize).limit(pageSize).all()

    return {
        "data": [employee_to_dict(e) for e in employees],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }


# ── Leaves ─────────────────────────────────────────────────────────────────────

@router.get("/leaves")
def get_leaves(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    employeeId: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = db.query(models.LeaveRequest)

    if status and status != "ALL":
        query = query.filter(models.LeaveRequest.status == status)
    if employeeId:
        query = query.filter(models.LeaveRequest.employeeId == employeeId)

    total = query.count()
    leaves = query.order_by(models.LeaveRequest.createdAt.desc()).offset((page - 1) * pageSize).limit(pageSize).all()

    return {
        "data": [
            {
                "id": lr.id,
                "employeeId": lr.employeeId,
                "employeeName": lr.employee.user.name if lr.employee and lr.employee.user else "",
                "type": lr.type,
                "startDate": lr.startDate.isoformat() if lr.startDate else None,
                "endDate": lr.endDate.isoformat() if lr.endDate else None,
                "days": lr.days,
                "reason": lr.reason,
                "status": lr.status,
                "createdAt": lr.createdAt.isoformat() if lr.createdAt else None,
            }
            for lr in leaves
        ],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }


@router.post("/leaves", status_code=201)
def create_leave(body: LeaveCreate, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    leave = models.LeaveRequest(
        id=generate_id(),
        employeeId=body.employeeId,
        type=body.type,
        startDate=datetime.fromisoformat(body.startDate),
        endDate=datetime.fromisoformat(body.endDate),
        days=body.days,
        reason=body.reason,
        status="PENDING",
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)
    return {"id": leave.id, "status": leave.status, "days": leave.days}


# ── Payroll ────────────────────────────────────────────────────────────────────

@router.get("/payroll")
def get_payroll(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = db.query(models.Payroll)

    if month:
        query = query.filter(models.Payroll.month == month)
    if year:
        query = query.filter(models.Payroll.year == year)

    total = query.count()
    records = query.order_by(models.Payroll.year.desc(), models.Payroll.month.desc()).offset((page - 1) * pageSize).limit(pageSize).all()

    return {
        "data": [
            {
                "id": p.id,
                "employeeId": p.employeeId,
                "employeeName": p.employee.user.name if p.employee and p.employee.user else "",
                "month": p.month,
                "year": p.year,
                "basicSalary": float(p.basicSalary),
                "allowances": float(p.allowances or 0),
                "bonus": float(p.bonus or 0),
                "overtimePay": float(p.overtimePay or 0),
                "deductions": float(p.deductions or 0),
                "taxDeduction": float(p.taxDeduction or 0),
                "grossSalary": float(p.grossSalary),
                "netSalary": float(p.netSalary),
                "status": p.status,
            }
            for p in records
        ],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }


@router.post("/payroll", status_code=201)
def create_payroll(body: PayrollCreate, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    existing = db.query(models.Payroll).filter(
        and_(
            models.Payroll.employeeId == body.employeeId,
            models.Payroll.month == body.month,
            models.Payroll.year == body.year,
        )
    ).first()

    if existing:
        raise HTTPException(status_code=409, detail="Payroll record already exists for this employee and period")

    gross = body.basicSalary + (body.allowances or 0) + (body.bonus or 0) + (body.overtimePay or 0)
    net = gross - (body.deductions or 0) - (body.taxDeduction or 0)

    payroll = models.Payroll(
        id=generate_id(),
        employeeId=body.employeeId,
        month=body.month,
        year=body.year,
        basicSalary=body.basicSalary,
        allowances=body.allowances or 0,
        bonus=body.bonus or 0,
        overtimePay=body.overtimePay or 0,
        deductions=body.deductions or 0,
        taxDeduction=body.taxDeduction or 0,
        grossSalary=gross,
        netSalary=net,
        notes=body.notes,
    )
    db.add(payroll)
    db.commit()
    db.refresh(payroll)
    return {"id": payroll.id, "grossSalary": float(payroll.grossSalary), "netSalary": float(payroll.netSalary)}


# ── Attendance ─────────────────────────────────────────────────────────────────

@router.get("/attendance")
def get_attendance(
    month: Optional[int] = None,
    year: Optional[int] = None,
    employeeId: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = db.query(models.Attendance)

    if employeeId:
        query = query.filter(models.Attendance.employeeId == employeeId)

    if month and year:
        from datetime import date as dt_date
        start = datetime(year, month, 1)
        end_month = month + 1 if month < 12 else 1
        end_year = year if month < 12 else year + 1
        end = datetime(end_year, end_month, 1)
        query = query.filter(and_(models.Attendance.date >= start, models.Attendance.date < end))

    records = query.order_by(models.Attendance.date.desc()).all()

    return {
        "data": [
            {
                "id": a.id,
                "employeeId": a.employeeId,
                "date": a.date.isoformat() if a.date else None,
                "checkIn": a.checkIn.isoformat() if a.checkIn else None,
                "checkOut": a.checkOut.isoformat() if a.checkOut else None,
                "status": a.status,
                "overtimeHrs": float(a.overtimeHrs) if a.overtimeHrs else None,
                "notes": a.notes,
                "isManual": a.isManual,
            }
            for a in records
        ]
    }


@router.post("/attendance", status_code=201)
def upsert_attendance(body: AttendanceCreate, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    date_val = datetime.fromisoformat(body.date)

    existing = db.query(models.Attendance).filter(
        and_(models.Attendance.employeeId == body.employeeId, models.Attendance.date == date_val)
    ).first()

    if existing:
        existing.checkIn = datetime.fromisoformat(body.checkIn) if body.checkIn else existing.checkIn
        existing.checkOut = datetime.fromisoformat(body.checkOut) if body.checkOut else existing.checkOut
        existing.status = body.status or existing.status
        existing.overtimeHrs = body.overtimeHrs
        existing.notes = body.notes
        db.commit()
        return {"id": existing.id, "updated": True}

    attendance = models.Attendance(
        id=generate_id(),
        employeeId=body.employeeId,
        date=date_val,
        checkIn=datetime.fromisoformat(body.checkIn) if body.checkIn else None,
        checkOut=datetime.fromisoformat(body.checkOut) if body.checkOut else None,
        status=body.status or "PRESENT",
        overtimeHrs=body.overtimeHrs,
        notes=body.notes,
        isManual=body.isManual if body.isManual is not None else True,
    )
    db.add(attendance)
    db.commit()
    return {"id": attendance.id, "created": True}
