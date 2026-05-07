from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, func

from database import get_db
from auth import get_current_user, require_roles, generate_id, sanitize_string, log_audit

HR_ROLES = ("HR_OFFICER", "SUPER_ADMIN", "CLINIC_MANAGER")
import models

router = APIRouter(prefix="/api/hr", tags=["hr"])

VALID_LEAVE_TYPES = {"ANNUAL", "SICK", "UNPAID", "EMERGENCY", "MATERNITY", "PATERNITY", "STUDY"}
VALID_EMP_TYPES = {"FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"}
VALID_STATUSES = {"ACTIVE", "ON_LEAVE", "SUSPENDED", "TERMINATED"}
SALARY_FIELDS = {"basicSalary", "housingAllowance", "transportAllowance", "medicalAllowance"}


# ── Pydantic Models ─────────────────────────────────────────────────────────────

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
    probationEndDate: Optional[str] = None
    annualLeaveBalance: Optional[int] = 21
    sickLeaveBalance: Optional[int] = 14
    branchId: Optional[str] = None
    reportsToId: Optional[str] = None
    bankName: Optional[str] = None
    bankAccount: Optional[str] = None

    @field_validator("employmentType")
    @classmethod
    def validate_emp_type(cls, v: str) -> str:
        if v not in VALID_EMP_TYPES:
            raise ValueError(f"employmentType must be one of {sorted(VALID_EMP_TYPES)}")
        return v


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
    reportsToId: Optional[str] = None
    bankName: Optional[str] = None
    bankAccount: Optional[str] = None
    salaryChangeReason: Optional[str] = None
    # User-level fields (name, phone, roles)
    userName: Optional[str] = None
    userPhone: Optional[str] = None
    userRoles: Optional[List[str]] = None


class TerminateCreate(BaseModel):
    reason: Optional[str] = None
    endDate: Optional[str] = None


class LeaveCreate(BaseModel):
    employeeId: str
    type: str
    startDate: str
    endDate: str
    days: int
    reason: Optional[str] = None

    @field_validator("type")
    @classmethod
    def validate_leave_type(cls, v: str) -> str:
        if v.upper() not in VALID_LEAVE_TYPES:
            raise ValueError(f"type must be one of {sorted(VALID_LEAVE_TYPES)}")
        return v.upper()

    @field_validator("days")
    @classmethod
    def validate_days(cls, v: int) -> int:
        if v < 1:
            raise ValueError("days must be at least 1")
        return v


class LeaveUpdate(BaseModel):
    status: str
    rejectedReason: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in {"APPROVED", "REJECTED", "CANCELLED"}:
            raise ValueError("status must be APPROVED, REJECTED, or CANCELLED")
        return v


class PayrollCreate(BaseModel):
    employeeId: str
    month: str
    basicSalary: Optional[float] = None
    allowances: Optional[float] = None
    bonus: Optional[float] = 0
    overtimePay: Optional[float] = 0
    deductions: Optional[float] = 0
    taxDeduction: Optional[float] = 0
    notes: Optional[str] = None


class BulkPayrollCreate(BaseModel):
    month: str  # YYYY-MM


class AttendanceCreate(BaseModel):
    employeeId: str
    date: str
    checkIn: Optional[str] = None
    checkOut: Optional[str] = None
    status: Optional[str] = "PRESENT"
    overtimeHrs: Optional[float] = None
    notes: Optional[str] = None
    isManual: Optional[bool] = True

    @field_validator("status")
    @classmethod
    def validate_att_status(cls, v: Optional[str]) -> Optional[str]:
        valid = {"PRESENT", "ABSENT", "LATE", "HALF_DAY", "ON_LEAVE"}
        if v and v not in valid:
            raise ValueError(f"status must be one of {sorted(valid)}")
        return v


# ── Helpers ─────────────────────────────────────────────────────────────────────

def mask_account(account: Optional[str]) -> Optional[str]:
    """Returns last-4 digits only, e.g. '****1234'. Returns None if empty."""
    if not account:
        return None
    trimmed = account.strip()
    if len(trimmed) <= 4:
        return trimmed
    return f"****{trimmed[-4:]}"


def _notify(
    db: Session,
    user_id: str,
    title: str,
    message: str,
    notif_type: str = "INFO",
    link: Optional[str] = None,
) -> None:
    """Fire-and-forget in-app notification. Never raises."""
    try:
        notif = models.Notification(
            id=generate_id(),
            userId=user_id,
            title=title,
            message=message,
            type=notif_type,
            link=link,
            isRead=False,
        )
        db.add(notif)
        db.commit()
    except Exception:
        db.rollback()


def _get_own_employee(user: models.User, db: Session) -> models.Employee:
    """Returns the Employee record linked to the current user, or 404."""
    emp = (
        db.query(models.Employee)
        .filter(models.Employee.userId == user.id, models.Employee.deletedAt == None)
        .options(joinedload(models.Employee.user), joinedload(models.Employee.department))
        .first()
    )
    if not emp:
        raise HTTPException(404, "No employee record found for your account")
    return emp


def _is_hr(user: models.User) -> bool:
    roles = user.roles if isinstance(user.roles, list) else []
    return any(r in HR_ROLES for r in roles)


def employee_to_dict(e: models.Employee, mask_bank: bool = True) -> dict:
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
        "probationEndDate": e.probationEndDate.isoformat() if e.probationEndDate else None,
        "annualLeaveBalance": e.annualLeaveBalance,
        "sickLeaveBalance": e.sickLeaveBalance,
        "branchId": e.branchId,
        "reportsToId": e.reportsToId,
        "bankName": e.bankName,
        "bankAccount": mask_account(e.bankAccount) if mask_bank else e.bankAccount,
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
    base = db.query(models.Employee).filter(models.Employee.deletedAt == None)
    total = base.count()
    active = base.filter(models.Employee.status == "ACTIVE").count()
    on_leave = base.filter(models.Employee.status == "ON_LEAVE").count()
    pending_leaves = db.query(func.count(models.LeaveRequest.id)).filter(
        models.LeaveRequest.status == "PENDING"
    ).scalar() or 0
    return {
        "totalEmployees": total,
        "activeEmployees": active,
        "onLeave": on_leave,
        "pendingLeaveRequests": pending_leaves,
    }


# ── Departments ────────────────────────────────────────────────────────────────

@router.get("/departments")
def get_departments(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    depts = db.query(models.Department).order_by(models.Department.name).all()
    return [{"id": d.id, "name": d.name, "code": d.code} for d in depts]


# ── Employees ──────────────────────────────────────────────────────────────────

@router.get("/employees")
def get_employees(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    status: Optional[str] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*HR_ROLES)),   # SEC-001 fix
):
    query = db.query(models.Employee).filter(models.Employee.deletedAt == None)

    if search:
        query = query.join(models.User, models.Employee.userId == models.User.id).filter(
            models.User.name.contains(search) | models.User.email.contains(search)
        )

    if status and status != "ALL":
        query = query.filter(models.Employee.status == status)

    if department and department not in ("ALL", ""):
        query = query.filter(models.Employee.departmentId == department)

    total = query.count()
    employees = (
        query
        .options(joinedload(models.Employee.user), joinedload(models.Employee.department))
        .order_by(models.Employee.empCode.asc())
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .all()
    )

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
    existing = db.query(models.Employee).filter(
        models.Employee.userId == body.userId, models.Employee.deletedAt == None
    ).first()
    if existing:
        raise HTTPException(400, "An employee record already exists for this user")
    from auth import generate_emp_code
    try:
        hire_date = datetime.fromisoformat(body.hireDate) if body.hireDate else datetime.now()
    except (ValueError, TypeError):
        raise HTTPException(400, "Invalid hireDate format")

    probation_end = None
    if body.probationEndDate:
        try:
            probation_end = datetime.fromisoformat(body.probationEndDate)
        except (ValueError, TypeError):
            raise HTTPException(400, "Invalid probationEndDate format")

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
        probationEndDate=probation_end,
        annualLeaveBalance=body.annualLeaveBalance,
        sickLeaveBalance=body.sickLeaveBalance,
        branchId=body.branchId,
        reportsToId=body.reportsToId,
        bankName=body.bankName,
        bankAccount=body.bankAccount,
        status="ACTIVE",
    )
    db.add(emp)
    db.flush()

    # Record initial salary in history
    history = models.SalaryHistory(
        id=generate_id(),
        employeeId=emp.id,
        changedById=user.id,
        basicSalary=body.basicSalary,
        housingAllowance=body.housingAllowance or 0,
        transportAllowance=body.transportAllowance or 0,
        medicalAllowance=body.medicalAllowance or 0,
        effectiveDate=hire_date,
        reason="Initial salary on hire",
    )
    db.add(history)
    db.commit()
    db.refresh(emp)
    log_audit(db, user.id, "CREATE", "Employee", emp.id, {"jobTitle": emp.jobTitle})
    return employee_to_dict(emp)


@router.get("/employees/{employee_id}")
def get_employee(employee_id: str, db: Session = Depends(get_db), _user=Depends(require_roles(*HR_ROLES))):
    emp = (
        db.query(models.Employee)
        .filter(models.Employee.id == employee_id, models.Employee.deletedAt == None)
        .options(joinedload(models.Employee.user), joinedload(models.Employee.department))
        .first()
    )
    if not emp:
        raise HTTPException(404, "Employee not found")
    return employee_to_dict(emp)


@router.patch("/employees/{employee_id}")
def update_employee(
    employee_id: str,
    body: EmployeeUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*HR_ROLES)),
):
    emp = db.query(models.Employee).filter(
        models.Employee.id == employee_id, models.Employee.deletedAt == None
    ).first()
    if not emp:
        raise HTTPException(404, "Employee not found")

    data = body.model_dump(exclude_none=True)
    user_fields = {"userName", "userPhone", "userRoles", "salaryChangeReason"}

    # Detect salary changes before applying
    salary_changed = any(f in data for f in SALARY_FIELDS)
    old_salary = {
        "basicSalary": float(emp.basicSalary),
        "housingAllowance": float(emp.housingAllowance or 0),
        "transportAllowance": float(emp.transportAllowance or 0),
        "medicalAllowance": float(emp.medicalAllowance or 0),
    }

    for field, val in data.items():
        if field not in user_fields:
            setattr(emp, field, val)

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

    if salary_changed:
        history = models.SalaryHistory(
            id=generate_id(),
            employeeId=emp.id,
            changedById=user.id,
            basicSalary=float(data.get("basicSalary", old_salary["basicSalary"])),
            housingAllowance=float(data.get("housingAllowance", old_salary["housingAllowance"])),
            transportAllowance=float(data.get("transportAllowance", old_salary["transportAllowance"])),
            medicalAllowance=float(data.get("medicalAllowance", old_salary["medicalAllowance"])),
            effectiveDate=datetime.now(),
            reason=sanitize_string(data.get("salaryChangeReason")) or "Salary update",
        )
        db.add(history)

    db.commit()
    db.refresh(emp)
    log_audit(db, user.id, "UPDATE", "Employee", emp.id, old_salary if salary_changed else {})
    return employee_to_dict(emp)


@router.post("/employees/{employee_id}/terminate", status_code=200)
def terminate_employee(
    employee_id: str,
    body: TerminateCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*HR_ROLES)),
):
    emp = db.query(models.Employee).filter(
        models.Employee.id == employee_id, models.Employee.deletedAt == None
    ).first()
    if not emp:
        raise HTTPException(404, "Employee not found")
    if emp.status == "TERMINATED":
        raise HTTPException(409, "Employee is already terminated")

    end_date = datetime.now()
    if body.endDate:
        try:
            end_date = datetime.fromisoformat(body.endDate)
        except (ValueError, TypeError):
            raise HTTPException(400, "Invalid endDate format")

    emp.status = "TERMINATED"
    emp.endDate = end_date

    # Cancel all pending leave requests
    db.query(models.LeaveRequest).filter(
        models.LeaveRequest.employeeId == employee_id,
        models.LeaveRequest.status == "PENDING",
    ).update({"status": "CANCELLED"}, synchronize_session=False)

    db.commit()
    log_audit(
        db, user.id, "TERMINATE", "Employee", emp.id,
        {"reason": body.reason, "endDate": end_date.isoformat()},
    )

    # Notify the terminated employee
    if emp.user:
        _notify(
            db, emp.user.id,
            "Employment Status Updated",
            f"Your employment has been updated. Please contact HR for details.",
            "WARNING",
            "/my-hr",
        )

    return {"id": emp.id, "status": emp.status, "endDate": end_date.isoformat()}


@router.get("/salary-history/{employee_id}")
def get_salary_history(
    employee_id: str,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*HR_ROLES)),
):
    emp = db.query(models.Employee).filter(
        models.Employee.id == employee_id, models.Employee.deletedAt == None
    ).first()
    if not emp:
        raise HTTPException(404, "Employee not found")

    records = (
        db.query(models.SalaryHistory)
        .filter(models.SalaryHistory.employeeId == employee_id)
        .options(joinedload(models.SalaryHistory.changedBy))
        .order_by(models.SalaryHistory.createdAt.desc())
        .all()
    )

    return [
        {
            "id": r.id,
            "basicSalary": float(r.basicSalary),
            "housingAllowance": float(r.housingAllowance or 0),
            "transportAllowance": float(r.transportAllowance or 0),
            "medicalAllowance": float(r.medicalAllowance or 0),
            "effectiveDate": r.effectiveDate.isoformat() if r.effectiveDate else None,
            "reason": r.reason,
            "changedBy": r.changedBy.name if r.changedBy else "",
            "createdAt": r.createdAt.isoformat() if r.createdAt else None,
        }
        for r in records
    ]


# ── Leaves ─────────────────────────────────────────────────────────────────────

@router.get("/leaves")
def get_leaves(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    employeeId: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*HR_ROLES)),   # SEC-001 fix
):
    query = db.query(models.LeaveRequest)

    if status and status != "ALL":
        query = query.filter(models.LeaveRequest.status == status)
    if employeeId:
        query = query.filter(models.LeaveRequest.employeeId == employeeId)

    total = query.count()
    leaves = (
        query
        .options(joinedload(models.LeaveRequest.employee).joinedload(models.Employee.user))
        .order_by(models.LeaveRequest.createdAt.desc())
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .all()
    )

    approver_ids = list({lr.approvedById for lr in leaves if lr.approvedById})
    approver_map: dict = {}
    if approver_ids:
        approvers = db.query(models.User).filter(models.User.id.in_(approver_ids)).all()
        approver_map = {u.id: u.name for u in approvers}

    return {
        "data": [_leave_to_dict(lr, approver_map) for lr in leaves],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }


def _leave_to_dict(lr: models.LeaveRequest, approver_map: dict = None) -> dict:
    return {
        "id": lr.id,
        "employeeId": lr.employeeId,
        "employeeName": lr.employee.user.name if lr.employee and lr.employee.user else "",
        "type": lr.type,
        "startDate": lr.startDate.isoformat() if lr.startDate else None,
        "endDate": lr.endDate.isoformat() if lr.endDate else None,
        "days": lr.days,
        "reason": lr.reason,
        "status": lr.status,
        "approvedById": lr.approvedById,
        "approverName": (approver_map or {}).get(lr.approvedById, "") if lr.approvedById else "",
        "rejectedReason": lr.rejectedReason,
        "createdAt": lr.createdAt.isoformat() if lr.createdAt else None,
    }


@router.patch("/leaves/{leave_id}")
def update_leave(
    leave_id: str,
    body: LeaveUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*HR_ROLES)),
):
    leave = (
        db.query(models.LeaveRequest)
        .options(joinedload(models.LeaveRequest.employee).joinedload(models.Employee.user))
        .filter(models.LeaveRequest.id == leave_id)
        .first()
    )
    if not leave:
        raise HTTPException(404, "Leave request not found")
    if leave.status != "PENDING":
        raise HTTPException(409, "Leave request has already been actioned")

    # SEC-004: Prevent self-approval — check if approver is the leave owner
    if leave.employee and leave.employee.userId == current_user.id:
        raise HTTPException(403, "You cannot approve or reject your own leave request")

    # F-006: Rejection must include a reason
    if body.status == "REJECTED" and not body.rejectedReason:
        raise HTTPException(422, "A rejection reason is required when rejecting a leave request")

    leave.status = body.status
    leave.approvedById = current_user.id
    leave.approvedAt = datetime.now()

    if body.status == "REJECTED" and body.rejectedReason:
        leave.rejectedReason = sanitize_string(body.rejectedReason)

    if body.status == "APPROVED":
        emp = db.query(models.Employee).filter(models.Employee.id == leave.employeeId).first()
        if emp:
            leave_type = leave.type.upper()
            # Balance check on approval
            if leave_type in ("ANNUAL",) and (emp.annualLeaveBalance or 0) < leave.days:
                raise HTTPException(
                    422,
                    f"Employee has only {emp.annualLeaveBalance} annual leave days remaining; requested {leave.days}",
                )
            if leave_type in ("SICK",) and (emp.sickLeaveBalance or 0) < leave.days:
                raise HTTPException(
                    422,
                    f"Employee has only {emp.sickLeaveBalance} sick leave days remaining; requested {leave.days}",
                )

            if leave_type == "ANNUAL":
                emp.annualLeaveBalance = max(0, (emp.annualLeaveBalance or 0) - leave.days)
            elif leave_type == "SICK":
                emp.sickLeaveBalance = max(0, (emp.sickLeaveBalance or 0) - leave.days)

            today = datetime.now().date()
            if leave.startDate and leave.endDate:
                if leave.startDate.date() <= today <= leave.endDate.date():
                    emp.status = "ON_LEAVE"

    db.commit()
    log_audit(db, current_user.id, "UPDATE", "LeaveRequest", leave.id, {"status": body.status})

    # Notify the employee
    if leave.employee and leave.employee.user:
        status_label = "approved" if body.status == "APPROVED" else "rejected"
        _notify(
            db, leave.employee.user.id,
            f"Leave Request {body.status.capitalize()}",
            f"Your {leave.type.lower()} leave request for {leave.days} day(s) has been {status_label}.",
            "SUCCESS" if body.status == "APPROVED" else "WARNING",
            "/my-hr",
        )

    return {"id": leave.id, "status": leave.status}


@router.post("/leaves", status_code=201)
def create_leave(body: LeaveCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
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

    # Employee isolation for non-HR users
    if not _is_hr(user):
        own_emp = (
            db.query(models.Employee)
            .filter(models.Employee.userId == user.id, models.Employee.deletedAt == None)
            .first()
        )
        if not own_emp or own_emp.id != body.employeeId:
            raise HTTPException(403, "You can only create leave requests for your own employee record")

    emp = db.query(models.Employee).filter(
        models.Employee.id == body.employeeId, models.Employee.deletedAt == None
    ).first()
    if not emp:
        raise HTTPException(404, "Employee not found")

    # F-005: Overlap detection — reject if another non-cancelled leave overlaps
    overlap = db.query(models.LeaveRequest).filter(
        models.LeaveRequest.employeeId == body.employeeId,
        models.LeaveRequest.status.in_(["PENDING", "APPROVED"]),
        models.LeaveRequest.startDate <= end,
        models.LeaveRequest.endDate >= start,
    ).first()
    if overlap:
        raise HTTPException(
            409,
            f"An overlapping leave request already exists ({overlap.startDate.date()} – {overlap.endDate.date()})",
        )

    # F-004: Pre-flight balance check (warning only for non-annual/sick, hard fail for annual/sick)
    leave_type = body.type.upper()
    if leave_type == "ANNUAL" and (emp.annualLeaveBalance or 0) < body.days:
        raise HTTPException(
            422,
            f"Insufficient annual leave balance. Available: {emp.annualLeaveBalance}, requested: {body.days}",
        )
    if leave_type == "SICK" and (emp.sickLeaveBalance or 0) < body.days:
        raise HTTPException(
            422,
            f"Insufficient sick leave balance. Available: {emp.sickLeaveBalance}, requested: {body.days}",
        )

    leave = models.LeaveRequest(
        id=generate_id(),
        employeeId=body.employeeId,
        type=leave_type,
        startDate=start,
        endDate=end,
        days=body.days,
        reason=sanitize_string(body.reason),
        status="PENDING",
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)
    log_audit(db, user.id, "CREATE", "LeaveRequest", leave.id, {"employeeId": body.employeeId, "type": leave_type, "days": body.days})
    return {"id": leave.id, "status": leave.status, "days": leave.days}


# ── Payroll ────────────────────────────────────────────────────────────────────

@router.get("/payroll")
def get_payroll(
    page: int = Query(1, ge=1),
    pageSize: int = Query(100, ge=1, le=500),
    month: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*HR_ROLES)),   # SEC-001 fix
):
    yr, mo = None, None
    if month:
        try:
            parts = month.split("-")
            yr, mo = int(parts[0]), int(parts[1])
        except (ValueError, IndexError):
            pass

    all_emps = (
        db.query(models.Employee)
        .filter(models.Employee.deletedAt == None, models.Employee.status != "TERMINATED")
        .options(joinedload(models.Employee.user), joinedload(models.Employee.department))
        .order_by(models.Employee.empCode.asc())
        .all()
    )

    payroll_map: dict = {}
    if yr and mo:
        records = db.query(models.Payroll).filter(
            models.Payroll.year == yr, models.Payroll.month == mo
        ).all()
        payroll_map = {p.employeeId: p for p in records}

    result = []
    for emp in all_emps:
        p = payroll_map.get(emp.id)
        allowances = float(emp.housingAllowance or 0) + float(emp.transportAllowance or 0) + float(emp.medicalAllowance or 0)
        if p:
            result.append({
                "id": p.id,
                "employeeId": emp.id,
                "employeeName": emp.user.name if emp.user else "",
                "department": emp.department.name if emp.department else "",
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
            })
        else:
            gross = float(emp.basicSalary) + allowances
            result.append({
                "id": None,
                "employeeId": emp.id,
                "employeeName": emp.user.name if emp.user else "",
                "department": emp.department.name if emp.department else "",
                "month": mo,
                "year": yr,
                "basicSalary": float(emp.basicSalary),
                "baseSalary": float(emp.basicSalary),
                "allowances": allowances,
                "bonus": 0,
                "overtimePay": 0,
                "deductions": 0,
                "taxDeduction": 0,
                "grossSalary": gross,
                "netSalary": gross,
                "netPay": gross,
                "status": "PENDING",
            })

    total = len(result)
    offset = (page - 1) * pageSize
    return {
        "data": result[offset: offset + pageSize],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }


@router.post("/payroll", status_code=201)
def create_payroll(body: PayrollCreate, db: Session = Depends(get_db), user=Depends(require_roles(*HR_ROLES))):
    try:
        parts = body.month.split("-")
        yr, mo = int(parts[0]), int(parts[1])
    except (ValueError, IndexError, AttributeError):
        raise HTTPException(400, "month must be in YYYY-MM format")

    # F-007: Pessimistic lock to prevent duplicate payroll race conditions
    employee = (
        db.query(models.Employee)
        .filter(models.Employee.id == body.employeeId, models.Employee.deletedAt == None)
        .with_for_update()
        .first()
    )
    if not employee:
        raise HTTPException(404, "Employee not found")

    existing = db.query(models.Payroll).filter(
        and_(
            models.Payroll.employeeId == body.employeeId,
            models.Payroll.month == mo,
            models.Payroll.year == yr,
        )
    ).first()
    if existing:
        raise HTTPException(409, "Payroll record already exists for this employee and period")

    base = body.basicSalary if body.basicSalary is not None else float(employee.basicSalary)
    auto_allowances = (
        float(employee.housingAllowance or 0)
        + float(employee.transportAllowance or 0)
        + float(employee.medicalAllowance or 0)
    )
    allowances = body.allowances if body.allowances is not None else auto_allowances
    gross = base + allowances + (body.bonus or 0) + (body.overtimePay or 0)
    net = gross - (body.deductions or 0) - (body.taxDeduction or 0)

    payroll = models.Payroll(
        id=generate_id(),
        employeeId=body.employeeId,
        month=mo,
        year=yr,
        basicSalary=base,
        allowances=allowances,
        bonus=body.bonus or 0,
        overtimePay=body.overtimePay or 0,
        deductions=body.deductions or 0,
        taxDeduction=body.taxDeduction or 0,
        grossSalary=gross,
        netSalary=net,
        status="PROCESSED",
        processedById=user.id,
        processedAt=datetime.now(),
        notes=body.notes,
    )
    db.add(payroll)
    db.commit()
    db.refresh(payroll)
    log_audit(db, user.id, "CREATE", "Payroll", payroll.id, {"employeeId": body.employeeId, "month": body.month})

    # Notify employee that payslip is ready
    if employee.user:
        _notify(
            db, employee.user.id,
            "Payslip Ready",
            f"Your payslip for {mo}/{yr} has been processed.",
            "SUCCESS",
            "/my-hr",
        )

    return {
        "id": payroll.id,
        "grossSalary": float(payroll.grossSalary),
        "netSalary": float(payroll.netSalary),
        "status": payroll.status,
    }


@router.post("/payroll/bulk", status_code=201)
def bulk_process_payroll(
    body: BulkPayrollCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*HR_ROLES)),
):
    """Process payroll for all active employees who don't yet have a record for the given month."""
    try:
        parts = body.month.split("-")
        yr, mo = int(parts[0]), int(parts[1])
    except (ValueError, IndexError, AttributeError):
        raise HTTPException(400, "month must be in YYYY-MM format")

    active_employees = (
        db.query(models.Employee)
        .filter(models.Employee.deletedAt == None, models.Employee.status == "ACTIVE")
        .options(joinedload(models.Employee.user))
        .all()
    )

    already_processed_ids = {
        row.employeeId
        for row in db.query(models.Payroll.employeeId).filter(
            models.Payroll.month == mo, models.Payroll.year == yr
        ).all()
    }

    created = []
    skipped = []
    for emp in active_employees:
        if emp.id in already_processed_ids:
            skipped.append(emp.id)
            continue

        allowances = (
            float(emp.housingAllowance or 0)
            + float(emp.transportAllowance or 0)
            + float(emp.medicalAllowance or 0)
        )
        gross = float(emp.basicSalary) + allowances
        net = gross  # No deductions in bulk run — HR can adjust individually after

        payroll = models.Payroll(
            id=generate_id(),
            employeeId=emp.id,
            month=mo,
            year=yr,
            basicSalary=float(emp.basicSalary),
            allowances=allowances,
            bonus=0,
            overtimePay=0,
            deductions=0,
            taxDeduction=0,
            grossSalary=gross,
            netSalary=net,
            status="PROCESSED",
            processedById=user.id,
            processedAt=datetime.now(),
        )
        db.add(payroll)
        created.append(emp.id)

        if emp.user:
            _notify(
                db, emp.user.id,
                "Payslip Ready",
                f"Your payslip for {mo}/{yr} has been processed.",
                "SUCCESS",
                "/my-hr",
            )

    db.commit()
    log_audit(db, user.id, "BULK_PROCESS", "Payroll", None, {"month": body.month, "created": len(created), "skipped": len(skipped)})
    return {"processed": len(created), "skipped": len(skipped), "month": body.month}


@router.get("/payroll/{payroll_id}/payslip")
def get_payslip(payroll_id: str, db: Session = Depends(get_db), user=Depends(require_roles(*HR_ROLES))):
    p = db.query(models.Payroll).filter(models.Payroll.id == payroll_id).first()
    if not p:
        raise HTTPException(404, "Payroll record not found")

    emp = p.employee
    emp_name = emp.user.name if emp and emp.user else ""
    dept_name = emp.department.name if emp and emp.department else ""
    job_title = emp.jobTitle if emp else ""

    from calendar import monthrange
    working_days = monthrange(p.year, p.month)[1]
    attended = db.query(func.count(models.Attendance.id)).filter(
        models.Attendance.employeeId == p.employeeId,
        models.Attendance.status.in_(["PRESENT", "LATE"]),
        func.year(models.Attendance.date) == p.year,
        func.month(models.Attendance.date) == p.month,
    ).scalar() or 0
    absent_days = max(0, working_days - attended)
    absence_deduction = round(float(p.basicSalary) / 30 * absent_days, 3)

    # SEC-003: Audit log payslip access
    log_audit(db, user.id, "READ", "Payslip", p.id, {"employeeId": p.employeeId, "month": p.month, "year": p.year})

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


# ── Attendance ─────────────────────────────────────────────────────────────────

@router.get("/attendance")
def get_attendance(
    month: Optional[str] = None,
    employeeId: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*HR_ROLES)),   # SEC-005 fix
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

    emp_ids = list({a.employeeId for a in records})
    emps = db.query(models.Employee).options(joinedload(models.Employee.user)).filter(
        models.Employee.id.in_(emp_ids)
    ).all() if emp_ids else []
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
def upsert_attendance(
    body: AttendanceCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*HR_ROLES)),   # SEC-005 fix
):
    try:
        date_val = datetime.fromisoformat(body.date)
    except (ValueError, TypeError):
        raise HTTPException(422, "Invalid date format")

    # F-008: Validate checkIn < checkOut when both provided
    check_in = None
    check_out = None
    if body.checkIn:
        try:
            check_in = datetime.fromisoformat(body.checkIn)
        except (ValueError, TypeError):
            raise HTTPException(422, "Invalid checkIn format")
    if body.checkOut:
        try:
            check_out = datetime.fromisoformat(body.checkOut)
        except (ValueError, TypeError):
            raise HTTPException(422, "Invalid checkOut format")

    if check_in and check_out and check_out <= check_in:
        raise HTTPException(422, "checkOut must be after checkIn")

    existing = db.query(models.Attendance).filter(
        and_(models.Attendance.employeeId == body.employeeId, models.Attendance.date == date_val)
    ).first()

    if existing:
        if check_in is not None:
            existing.checkIn = check_in
        if check_out is not None:
            existing.checkOut = check_out
        existing.status = body.status or existing.status
        existing.overtimeHrs = body.overtimeHrs
        existing.notes = body.notes
        existing.enteredById = user.id
        db.commit()
        log_audit(db, user.id, "UPDATE", "Attendance", existing.id, {"employeeId": body.employeeId, "date": body.date, "status": body.status})
        return {"id": existing.id, "updated": True}

    attendance = models.Attendance(
        id=generate_id(),
        employeeId=body.employeeId,
        date=date_val,
        checkIn=check_in,
        checkOut=check_out,
        status=body.status or "PRESENT",
        overtimeHrs=body.overtimeHrs,
        notes=body.notes,
        enteredById=user.id,
        isManual=body.isManual if body.isManual is not None else True,
    )
    db.add(attendance)
    db.commit()
    log_audit(db, user.id, "CREATE", "Attendance", attendance.id, {"employeeId": body.employeeId, "date": body.date, "status": body.status})
    return {"id": attendance.id, "created": True}


@router.get("/attendance/summary/{employee_id}")
def attendance_summary(
    employee_id: str,
    month: str = Query(..., description="YYYY-MM"),
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*HR_ROLES)),   # SEC-001 fix
):
    from calendar import monthrange
    try:
        parts = month.split("-")
        yr, mo = int(parts[0]), int(parts[1])
    except (ValueError, IndexError):
        raise HTTPException(400, "month must be YYYY-MM")

    emp = db.query(models.Employee).filter(
        models.Employee.id == employee_id, models.Employee.deletedAt == None
    ).first()
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

    present = sum(1 for r in records if r.status in ("PRESENT", "LATE"))
    absent = total_days - present
    late = sum(1 for r in records if r.status == "LATE")

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
        "lateDays": late,
        "avgCheckIn": avg_checkin,
        "attendancePct": round(present / total_days * 100, 1) if total_days > 0 else 0,
    }


# ── ESS — Employee Self-Service ────────────────────────────────────────────────

@router.get("/me/profile")
def get_own_profile(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Returns the current user's own employee record (unmasked bank account)."""
    emp = _get_own_employee(user, db)
    return employee_to_dict(emp, mask_bank=False)


@router.get("/me/leaves")
def get_own_leaves(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Returns only the current user's own leave requests."""
    emp = _get_own_employee(user, db)

    query = db.query(models.LeaveRequest).filter(models.LeaveRequest.employeeId == emp.id)
    total = query.count()
    leaves = (
        query
        .options(joinedload(models.LeaveRequest.employee).joinedload(models.Employee.user))
        .order_by(models.LeaveRequest.createdAt.desc())
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .all()
    )

    approver_ids = list({lr.approvedById for lr in leaves if lr.approvedById})
    approver_map: dict = {}
    if approver_ids:
        approvers = db.query(models.User).filter(models.User.id.in_(approver_ids)).all()
        approver_map = {u.id: u.name for u in approvers}

    return {
        "data": [_leave_to_dict(lr, approver_map) for lr in leaves],
        "total": total,
        "page": page,
        "pageSize": pageSize,
        "annualLeaveBalance": emp.annualLeaveBalance,
        "sickLeaveBalance": emp.sickLeaveBalance,
    }


@router.post("/me/leaves", status_code=201)
def create_own_leave(body: LeaveCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Employee submits their own leave request."""
    emp = _get_own_employee(user, db)
    # Enforce own employee only
    if body.employeeId != emp.id:
        raise HTTPException(403, "You can only create leave requests for your own employee record")
    # Delegate to the main create_leave logic
    return create_leave(body, db, user)


@router.get("/me/payroll")
def get_own_payroll(
    page: int = Query(1, ge=1),
    pageSize: int = Query(12, ge=1, le=60),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Returns the current user's own processed payslips (no salary of others)."""
    emp = _get_own_employee(user, db)

    total = db.query(func.count(models.Payroll.id)).filter(
        models.Payroll.employeeId == emp.id
    ).scalar() or 0

    records = (
        db.query(models.Payroll)
        .filter(models.Payroll.employeeId == emp.id)
        .order_by(models.Payroll.year.desc(), models.Payroll.month.desc())
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .all()
    )

    return {
        "data": [
            {
                "id": p.id,
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


@router.get("/me/attendance")
def get_own_attendance(
    month: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Returns the current user's own attendance records."""
    emp = _get_own_employee(user, db)

    query = db.query(models.Attendance).filter(models.Attendance.employeeId == emp.id)
    if month:
        try:
            parts = month.split("-")
            yr, mo = int(parts[0]), int(parts[1])
            start = datetime(yr, mo, 1)
            end_mo = mo + 1 if mo < 12 else 1
            end_yr = yr if mo < 12 else yr + 1
            end = datetime(end_yr, end_mo, 1)
            query = query.filter(and_(models.Attendance.date >= start, models.Attendance.date < end))
        except (ValueError, IndexError):
            pass

    records = query.order_by(models.Attendance.date.asc()).all()
    return {
        "data": [
            {
                "id": a.id,
                "date": a.date.strftime("%Y-%m-%d") if a.date else None,
                "checkIn": a.checkIn.strftime("%H:%M") if a.checkIn else None,
                "checkOut": a.checkOut.strftime("%H:%M") if a.checkOut else None,
                "status": a.status,
                "overtimeHrs": float(a.overtimeHrs) if a.overtimeHrs else None,
                "notes": a.notes,
            }
            for a in records
        ]
    }
