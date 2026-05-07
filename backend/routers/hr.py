from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from database import get_db
from auth import get_current_user, require_roles, generate_id, sanitize_string

HR_ROLES = ("HR_OFFICER", "SUPER_ADMIN", "CLINIC_MANAGER")
import models

router = APIRouter(prefix="/api/hr", tags=["hr"])


class EmployeeCreate(BaseModel):
    userId: str
    departmentId: str
    jobTitle: str
    employmentType: str = "FULL_TIME"
    basicSalary: float = 0
    housingAllowance: Optional[float] = 0
    transportAllowance: Optional[float] = 0
    medicalAllowance: Optional[float] = 0
    hireDate: Optional[str] = None
    annualLeaveBalance: Optional[int] = 21
    sickLeaveBalance: Optional[int] = 14
    branchId: Optional[str] = None


class EmployeeUpdate(BaseModel):
    jobTitle: Optional[str] = None
    employmentType: Optional[str] = None
    status: Optional[str] = None
    basicSalary: Optional[float] = None
    housingAllowance: Optional[float] = None
    transportAllowance: Optional[float] = None
    medicalAllowance: Optional[float] = None
    departmentId: Optional[str] = None
    annualLeaveBalance: Optional[int] = None
    sickLeaveBalance: Optional[int] = None
    branchId: Optional[str] = None
    # User-level fields (name, phone, roles)
    userName: Optional[str] = None
    userPhone: Optional[str] = None
    userRoles: Optional[List[str]] = None


class LeaveCreate(BaseModel):
    employeeId: str
    type: str
    startDate: str
    endDate: str
    days: int
    reason: Optional[str] = None


class PayrollCreate(BaseModel):
    employeeId: str
    month: str
    basicSalary: Optional[float] = None
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
        "branchId": e.branchId,
        "user": {
            "id": e.user.id if e.user else None,
            "name": e.user.name if e.user else "",
            "email": e.user.email if e.user else "",
            "phone": e.user.phone if e.user else None,
            "photo": e.user.photo if e.user else None,
            "roles": e.user.roles if e.user else [],
            "isActive": e.user.isActive if e.user else True,
        },
        "department": {
            "id": e.department.id if e.department else None,
            "name": e.department.name if e.department else "",
        },
        "createdAt": e.createdAt.isoformat() if e.createdAt else None,
    }


# ── Stats ──────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_hr_stats(db: Session = Depends(get_db), _user=Depends(require_roles(*HR_ROLES))):
    total = db.query(func.count(models.Employee.id)).scalar() or 0
    active = db.query(func.count(models.Employee.id)).filter(models.Employee.status == "ACTIVE").scalar() or 0
    on_leave = db.query(func.count(models.Employee.id)).filter(models.Employee.status == "ON_LEAVE").scalar() or 0
    pending_leaves = db.query(func.count(models.LeaveRequest.id)).filter(models.LeaveRequest.status == "PENDING").scalar() or 0
    return {
        "totalEmployees": total,
        "activeEmployees": active,
        "onLeave": on_leave,
        "pendingLeaveRequests": pending_leaves,
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


@router.post("/employees", status_code=201)
def create_employee(body: EmployeeCreate, db: Session = Depends(get_db), user=Depends(require_roles(*HR_ROLES))):
    if not body.userId or not body.departmentId or not body.jobTitle:
        raise HTTPException(400, "userId, departmentId, and jobTitle are required")
    existing = db.query(models.Employee).filter(models.Employee.userId == body.userId).first()
    if existing:
        raise HTTPException(400, "An employee record already exists for this user")
    from auth import generate_emp_code, log_audit
    try:
        hire_date = datetime.fromisoformat(body.hireDate) if body.hireDate else datetime.now()
    except (ValueError, TypeError):
        raise HTTPException(400, "Invalid hireDate format")

    emp = models.Employee(
        id=generate_id(),
        userId=body.userId,
        departmentId=body.departmentId,
        jobTitle=sanitize_string(body.jobTitle),
        empCode=generate_emp_code(db),
        employmentType=body.employmentType,
        basicSalary=body.basicSalary,
        housingAllowance=body.housingAllowance or 0,
        transportAllowance=body.transportAllowance or 0,
        medicalAllowance=body.medicalAllowance or 0,
        hireDate=hire_date,
        annualLeaveBalance=body.annualLeaveBalance,
        sickLeaveBalance=body.sickLeaveBalance,
        branchId=body.branchId,
        status="ACTIVE",
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    log_audit(db, user.id, "CREATE", "Employee", emp.id, {"jobTitle": emp.jobTitle})
    return employee_to_dict(emp)


@router.get("/employees/{employee_id}")
def get_employee(employee_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    emp = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(404, "Employee not found")
    return employee_to_dict(emp)


@router.patch("/employees/{employee_id}")
def update_employee(employee_id: str, body: EmployeeUpdate, db: Session = Depends(get_db), user=Depends(require_roles(*HR_ROLES))):
    from auth import log_audit
    emp = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(404, "Employee not found")

    user_fields = {"userName", "userPhone", "userRoles"}
    data = body.model_dump(exclude_none=True)

    # Apply employee fields
    for field, val in data.items():
        if field not in user_fields:
            setattr(emp, field, val)

    # Apply user-level fields on the linked User record
    if user_fields & data.keys():
        linked_user = db.query(models.User).filter(models.User.id == emp.userId).first()
        if linked_user:
            if "userName" in data:
                linked_user.name = data["userName"]
            if "userPhone" in data:
                linked_user.phone = data["userPhone"]
            if "userRoles" in data and data["userRoles"]:
                from routers.users import VALID_ROLES
                invalid = set(data["userRoles"]) - VALID_ROLES
                if invalid:
                    raise HTTPException(422, f"Invalid roles: {sorted(invalid)}")
                linked_user.roles = data["userRoles"]

    db.commit()
    db.refresh(emp)
    log_audit(db, user.id, "UPDATE", "Employee", emp.id, {})
    return employee_to_dict(emp)


@router.get("/departments")
def get_departments(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    depts = db.query(models.Department).order_by(models.Department.name).all()
    return [{"id": d.id, "name": d.name, "code": d.code} for d in depts]


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


@router.patch("/leaves/{leave_id}")
def update_leave(leave_id: str, body: dict, db: Session = Depends(get_db), current_user=Depends(require_roles(*HR_ROLES))):
    leave = db.query(models.LeaveRequest).filter(models.LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if "status" in body:
        leave.status = body["status"]
        if body["status"] in ("APPROVED", "REJECTED"):
            leave.approvedById = current_user.id
    db.commit()
    return {"id": leave.id, "status": leave.status}


@router.post("/leaves", status_code=201)
def create_leave(body: LeaveCreate, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    try:
        start = datetime.fromisoformat(body.startDate)
        end = datetime.fromisoformat(body.endDate)
    except (ValueError, TypeError):
        raise HTTPException(422, "Invalid date format for startDate or endDate")

    if end < start:
        raise HTTPException(422, "endDate must be on or after startDate")

    calculated_days = (end.date() - start.date()).days + 1
    if body.days != calculated_days:
        raise HTTPException(
            422,
            f"days field ({body.days}) does not match date range ({calculated_days} days)",
        )

    leave = models.LeaveRequest(
        id=generate_id(),
        employeeId=body.employeeId,
        type=body.type,
        startDate=start,
        endDate=end,
        days=body.days,
        reason=sanitize_string(body.reason),
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
    month: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = db.query(models.Payroll)

    if month:
        try:
            parts = month.split("-")
            yr, mo = int(parts[0]), int(parts[1])
            query = query.filter(models.Payroll.year == yr, models.Payroll.month == mo)
        except (ValueError, IndexError):
            pass

    total = query.count()
    records = query.order_by(models.Payroll.year.desc(), models.Payroll.month.desc()).offset((page - 1) * pageSize).limit(pageSize).all()

    return {
        "data": [
            {
                "id": p.id,
                "employeeId": p.employeeId,
                "employeeName": p.employee.user.name if p.employee and p.employee.user else "",
                "department": p.employee.department.name if p.employee and p.employee.department else "",
                "month": p.month,
                "year": p.year,
                "basicSalary": float(p.basicSalary),
                "baseSalary": float(p.basicSalary),
                "allowances": float(p.allowances or 0),
                "bonus": float(p.bonus or 0),
                "overtimePay": float(p.overtimePay or 0),
                "deductions": float(p.deductions or 0),
                "taxDeduction": float(p.taxDeduction or 0),
                "grossSalary": float(p.grossSalary),
                "netSalary": float(p.netSalary),
                "netPay": float(p.netSalary),
                "status": p.status,
            }
            for p in records
        ],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }


@router.post("/payroll", status_code=201)
def create_payroll(body: PayrollCreate, db: Session = Depends(get_db), _user=Depends(require_roles(*HR_ROLES))):
    try:
        parts = body.month.split("-")
        yr, mo = int(parts[0]), int(parts[1])
    except (ValueError, IndexError, AttributeError):
        raise HTTPException(status_code=400, detail="month must be in YYYY-MM format")

    employee = db.query(models.Employee).filter(models.Employee.id == body.employeeId).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    base = body.basicSalary if body.basicSalary is not None else float(employee.basicSalary)

    existing = db.query(models.Payroll).filter(
        and_(
            models.Payroll.employeeId == body.employeeId,
            models.Payroll.month == mo,
            models.Payroll.year == yr,
        )
    ).first()

    if existing:
        raise HTTPException(status_code=409, detail="Payroll record already exists for this employee and period")

    gross = base + (body.allowances or 0) + (body.bonus or 0) + (body.overtimePay or 0)
    net = gross - (body.deductions or 0) - (body.taxDeduction or 0)

    payroll = models.Payroll(
        id=generate_id(),
        employeeId=body.employeeId,
        month=mo,
        year=yr,
        basicSalary=base,
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
    month: Optional[str] = None,
    employeeId: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    raw_records = db.query(models.Attendance)

    if employeeId:
        raw_records = raw_records.filter(models.Attendance.employeeId == employeeId)

    yr, mo = None, None
    if month:
        try:
            parts = month.split("-")
            yr, mo = int(parts[0]), int(parts[1])
            start = datetime(yr, mo, 1)
            end_mo = mo + 1 if mo < 12 else 1
            end_yr = yr if mo < 12 else yr + 1
            end = datetime(end_yr, end_mo, 1)
            raw_records = raw_records.filter(and_(models.Attendance.date >= start, models.Attendance.date < end))
        except (ValueError, IndexError):
            pass

    records = raw_records.order_by(models.Attendance.date.asc()).all()

    # Batch-load all referenced employees in one query (avoids N+1)
    emp_ids = list({a.employeeId for a in records})
    emps = db.query(models.Employee).filter(models.Employee.id.in_(emp_ids)).all() if emp_ids else []
    emp_map: dict = {e.id: (e.user.name if e.user else e.id) for e in emps}

    if search:
        emp_map = {k: v for k, v in emp_map.items() if search.lower() in v.lower()}
        records = [r for r in records if r.employeeId in emp_map]

    grouped: dict = {}
    for a in records:
        eid = a.employeeId
        if eid not in grouped:
            grouped[eid] = {"employeeId": eid, "employeeName": emp_map.get(eid, eid), "days": {}}
        if a.date:
            key = a.date.strftime("%Y-%m-%d")
            grouped[eid]["days"][key] = a.status

    return {"data": list(grouped.values())}


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


@router.get("/payroll/{payroll_id}/payslip")
def get_payslip(payroll_id: str, db: Session = Depends(get_db), _user=Depends(require_roles(*HR_ROLES))):
    p = db.query(models.Payroll).filter(models.Payroll.id == payroll_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payroll record not found")

    emp = p.employee
    emp_name = emp.user.name if emp and emp.user else ""
    dept_name = emp.department.name if emp and emp.department else ""
    job_title = emp.jobTitle if emp else ""

    # Calculate absence deduction from attendance
    from calendar import monthrange
    working_days = monthrange(p.year, p.month)[1]
    attended = db.query(func.count(models.Attendance.id)).filter(
        models.Attendance.employeeId == p.employeeId,
        models.Attendance.status == "PRESENT",
        func.year(models.Attendance.date) == p.year,
        func.month(models.Attendance.date) == p.month,
    ).scalar() or 0
    absent_days = max(0, working_days - attended)
    absence_deduction = round(float(p.basicSalary) / 30 * absent_days, 3)

    return {
        "id": p.id,
        "employeeName": emp_name,
        "department": dept_name,
        "jobTitle": job_title,
        "month": p.month,
        "year": p.year,
        "basicSalary": float(p.basicSalary),
        "allowances": float(p.allowances or 0),
        "bonus": float(p.bonus or 0),
        "overtimePay": float(p.overtimePay or 0),
        "deductions": float(p.deductions or 0),
        "taxDeduction": float(p.taxDeduction or 0),
        "absenceDays": absent_days,
        "absenceDeduction": absence_deduction,
        "grossSalary": float(p.grossSalary),
        "netSalary": float(p.netSalary),
        "status": p.status,
        "notes": p.notes,
    }


@router.get("/attendance/summary/{employee_id}")
def attendance_summary(
    employee_id: str,
    month: str = Query(..., description="YYYY-MM"),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    from calendar import monthrange
    try:
        parts = month.split("-")
        yr, mo = int(parts[0]), int(parts[1])
    except (ValueError, IndexError):
        raise HTTPException(400, "month must be YYYY-MM")

    emp = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(404, "Employee not found")

    total_days = monthrange(yr, mo)[1]
    start = datetime(yr, mo, 1)
    end_mo = mo + 1 if mo < 12 else 1
    end_yr = yr if mo < 12 else yr + 1
    end = datetime(end_yr, end_mo, 1)

    records = db.query(models.Attendance).filter(
        models.Attendance.employeeId == employee_id,
        models.Attendance.date >= start,
        models.Attendance.date < end,
    ).all()

    present = sum(1 for r in records if r.status == "PRESENT")
    absent = total_days - present

    avg_checkin = None
    checkin_times = [r.checkIn for r in records if r.checkIn]
    if checkin_times:
        avg_seconds = sum(t.hour * 3600 + t.minute * 60 for t in checkin_times) / len(checkin_times)
        avg_h = int(avg_seconds // 3600)
        avg_m = int((avg_seconds % 3600) // 60)
        avg_checkin = f"{avg_h:02d}:{avg_m:02d}"

    return {
        "employeeId": employee_id,
        "month": month,
        "totalWorkingDays": total_days,
        "presentDays": present,
        "absentDays": absent,
        "avgCheckIn": avg_checkin,
    }
