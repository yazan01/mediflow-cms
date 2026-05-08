from datetime import datetime, timedelta
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
VALID_STATUSES = {"ACTIVE", "INACTIVE", "ON_LEAVE", "SUSPENDED", "TERMINATED"}
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
    medicalCert: Optional[bool] = False

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
    pageSize: int = Query(20, ge=1, le=5000),
    search: str = Query(""),
    status: Optional[str] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*HR_ROLES)),   # SEC-001 fix
):
    query = db.query(models.Employee).filter(models.Employee.deletedAt == None)

    if search:
        query = query.join(models.User, models.Employee.userId == models.User.id).filter(
            models.User.name.contains(search)
            | models.User.email.contains(search)
            | models.Employee.jobTitle.contains(search)
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

    if "status" in data and data["status"] not in VALID_STATUSES:
        raise HTTPException(422, f"status must be one of {sorted(VALID_STATUSES)}")
    if "employmentType" in data and data["employmentType"] not in VALID_EMP_TYPES:
        raise HTTPException(422, f"employmentType must be one of {sorted(VALID_EMP_TYPES)}")

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

    # SEC-004: Deactivate user account so existing and future logins are blocked immediately
    linked_user = db.query(models.User).filter(models.User.id == emp.userId).first()
    if linked_user:
        linked_user.isActive = False

    # Cancel all pending leave requests
    db.query(models.LeaveRequest).filter(
        models.LeaveRequest.employeeId == employee_id,
        models.LeaveRequest.status == "PENDING",
    ).update({"status": "CANCELLED"}, synchronize_session=False)

    # F-017: End all active shift assignments
    db.query(models.ShiftAssignment).filter(
        models.ShiftAssignment.employeeId == employee_id,
        (models.ShiftAssignment.endDate == None) | (models.ShiftAssignment.endDate >= datetime.now()),
    ).update({"endDate": end_date}, synchronize_session=False)

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
        "empCode": lr.employee.empCode if lr.employee else None,
        "type": lr.type,
        "startDate": lr.startDate.isoformat() if lr.startDate else None,
        "endDate": lr.endDate.isoformat() if lr.endDate else None,
        "days": lr.days,
        "reason": lr.reason,
        "medicalCert": lr.medicalCert,
        "status": lr.status,
        "approvedById": lr.approvedById,
        "approverName": (approver_map or {}).get(lr.approvedById, "") if lr.approvedById else "",
        "rejectedReason": lr.rejectedReason,
        "annualLeaveBalance": lr.employee.annualLeaveBalance if lr.employee else None,
        "sickLeaveBalance": lr.employee.sickLeaveBalance if lr.employee else None,
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
        medicalCert=bool(body.medicalCert),
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
    # Tax engine: use ClinicSetting.taxRate when taxDeduction not manually provided
    if body.taxDeduction is not None:
        tax_deduction = body.taxDeduction
    else:
        setting = db.query(models.ClinicSetting).filter(models.ClinicSetting.id == 1).first()
        tax_rate = float(setting.taxRate) if setting and setting.taxRate is not None else 0.0
        tax_deduction = round(gross * tax_rate / 100, 3)
    net = gross - (body.deductions or 0) - tax_deduction

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
        taxDeduction=tax_deduction,
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

    # Tax engine: fetch clinic tax rate once for the whole bulk run
    setting = db.query(models.ClinicSetting).filter(models.ClinicSetting.id == 1).first()
    clinic_tax_rate = float(setting.taxRate) if setting and setting.taxRate is not None else 0.0

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
        tax_deduction = round(gross * clinic_tax_rate / 100, 3)
        net = gross - tax_deduction

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
            taxDeduction=tax_deduction,
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


@router.patch("/payroll/{payroll_id}/reverse", status_code=200)
def reverse_payroll(payroll_id: str, db: Session = Depends(get_db), user=Depends(require_roles("SUPER_ADMIN", "CLINIC_MANAGER"))):
    p = db.query(models.Payroll).filter(models.Payroll.id == payroll_id).first()
    if not p:
        raise HTTPException(404, "Payroll record not found")
    if p.status != "PROCESSED":
        raise HTTPException(409, "Only PROCESSED payroll records can be reversed")
    p.status = "REVERSED"
    db.commit()
    log_audit(db, user.id, "REVERSE", "Payroll", p.id, {"employeeId": p.employeeId, "month": p.month, "year": p.year})
    return {"id": p.id, "status": p.status}


# ── Leave Policies CRUD ────────────────────────────────────────────────────────

class LeavePolicyUpdate(BaseModel):
    maxDaysPerYear: Optional[int] = None
    carryForwardMax: Optional[int] = None
    requiresMedicalCert: Optional[bool] = None
    probationAllowed: Optional[bool] = None
    minServiceDays: Optional[int] = None
    encashmentAllowed: Optional[bool] = None


@router.patch("/leave-policies/{policy_id}")
def update_leave_policy(
    policy_id: str,
    body: LeavePolicyUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*HR_ROLES)),
):
    policy = db.query(models.LeavePolicy).filter(models.LeavePolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(404, "Leave policy not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(policy, field, val)
    db.commit()
    db.refresh(policy)
    log_audit(db, user.id, "UPDATE", "LeavePolicy", policy_id, {"leaveType": policy.leaveType})
    return {
        "id": policy.id,
        "leaveType": policy.leaveType,
        "maxDaysPerYear": policy.maxDaysPerYear,
        "carryForwardMax": policy.carryForwardMax,
        "requiresMedicalCert": policy.requiresMedicalCert,
        "probationAllowed": policy.probationAllowed,
        "minServiceDays": policy.minServiceDays,
        "encashmentAllowed": policy.encashmentAllowed,
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


# ── Phase 3 — Compliance & Regulatory ─────────────────────────────────────────

# ── Probation Alerts ──────────────────────────────────────────────────────────

@router.get("/employees/probation-alerts")
def get_probation_alerts(
    days_ahead: int = Query(30),
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*HR_ROLES)),
):
    """Employees whose probation ends within the next N days."""
    cutoff = datetime.now() + timedelta(days=days_ahead)
    employees = (
        db.query(models.Employee)
        .filter(
            models.Employee.deletedAt == None,
            models.Employee.status == "ACTIVE",
            models.Employee.probationEndDate != None,
            models.Employee.probationEndDate >= datetime.now(),
            models.Employee.probationEndDate <= cutoff,
        )
        .options(joinedload(models.Employee.user), joinedload(models.Employee.department))
        .all()
    )
    today = datetime.now().date()
    return [
        {
            "id": emp.id,
            "empCode": emp.empCode,
            "employeeName": emp.user.name if emp.user else "",
            "department": emp.department.name if emp.department else "",
            "probationEndDate": emp.probationEndDate.isoformat() if emp.probationEndDate else None,
            "daysLeft": (emp.probationEndDate.date() - today).days if emp.probationEndDate else 0,
        }
        for emp in employees
    ]


# ── End-of-Service Gratuity Calculator ────────────────────────────────────────

@router.get("/employees/{employee_id}/eos")
def calculate_eos(
    employee_id: str,
    reason: str = Query("terminated", description="resigned or terminated"),
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*HR_ROLES)),
):
    """Jordan Labor Law Article 32 end-of-service gratuity calculation."""
    emp = (
        db.query(models.Employee)
        .filter(models.Employee.id == employee_id, models.Employee.deletedAt == None)
        .options(joinedload(models.Employee.user))
        .first()
    )
    if not emp:
        raise HTTPException(404, "Employee not found")

    hire_date = emp.hireDate.date() if emp.hireDate else None
    if not hire_date:
        raise HTTPException(422, "Employee hire date is required for EOS calculation")

    today = datetime.now().date()
    years = (today - hire_date).days / 365.25
    basic = float(emp.basicSalary)

    def _resignation_eos(yrs: float, b: float) -> float:
        if yrs < 1: return 0.0
        elif yrs < 3: return b * yrs * (1 / 3)
        elif yrs < 5: return b * yrs * (2 / 3)
        else: return b * yrs

    def _termination_eos(yrs: float, b: float) -> float:
        if yrs < 1: return 0.0
        elif yrs <= 5: return b * yrs
        elif yrs <= 10: return b * 5 + b * 1.5 * (yrs - 5)
        else: return b * 5 + b * 1.5 * 5 + b * 2 * (yrs - 10)

    resignation_eos = _resignation_eos(years, basic)
    termination_eos = _termination_eos(years, basic)
    gratuity = resignation_eos if reason.lower() == "resigned" else termination_eos

    return {
        "employeeId": employee_id,
        "employeeName": emp.user.name if emp.user else "",
        "hireDate": hire_date.isoformat(),
        "yearsOfService": int(years),
        "fractionYear": round(years % 1, 2),
        "monthlySalary": basic,
        "basicSalary": basic,
        "resignationEos": round(resignation_eos, 2),
        "terminationEos": round(termination_eos, 2),
        "gratuity": round(gratuity, 2),
        "reason": reason,
    }


# ── Leave Cancellation ─────────────────────────────────────────────────────────

@router.delete("/leaves/{leave_id}")
def cancel_leave(leave_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Cancel a pending leave request. Non-HR users can only cancel their own."""
    leave = db.query(models.LeaveRequest).filter(models.LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(404, "Leave request not found")
    if leave.status != "PENDING":
        raise HTTPException(409, "Only pending leave requests can be cancelled")

    if not _is_hr(user):
        own_emp = db.query(models.Employee).filter(
            models.Employee.userId == user.id, models.Employee.deletedAt == None
        ).first()
        if not own_emp or own_emp.id != leave.employeeId:
            raise HTTPException(403, "You can only cancel your own leave requests")

    leave.status = "CANCELLED"
    db.commit()
    log_audit(db, user.id, "CANCEL", "LeaveRequest", leave.id, {"employeeId": leave.employeeId})
    return {"id": leave.id, "status": "CANCELLED"}


# ── Year-End Leave Carry-Forward ───────────────────────────────────────────────

class CarryForwardBody(BaseModel):
    maxCarryDays: Optional[int] = 5
    annualBaseReset: Optional[int] = 21
    sickBaseReset: Optional[int] = 14


@router.post("/leaves/carry-forward")
def carry_forward_leaves(
    body: CarryForwardBody,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*HR_ROLES)),
):
    """Year-end leave balance reset with carry-forward of unused days (up to maxCarryDays)."""
    active_employees = db.query(models.Employee).filter(
        models.Employee.deletedAt == None,
        models.Employee.status.in_(["ACTIVE", "ON_LEAVE"]),
    ).all()

    updated = 0
    max_carry = body.maxCarryDays if body.maxCarryDays is not None else 5
    annual_base = body.annualBaseReset if body.annualBaseReset is not None else 21
    sick_base = body.sickBaseReset if body.sickBaseReset is not None else 14

    for emp in active_employees:
        carry = min(emp.annualLeaveBalance or 0, max_carry)
        emp.annualLeaveBalance = annual_base + carry
        emp.sickLeaveBalance = sick_base
        updated += 1

    db.commit()
    log_audit(
        db, user.id, "CARRY_FORWARD", "Employee", None,
        {"employeesUpdated": updated, "maxCarryDays": max_carry},
    )
    return {"updated": updated, "maxCarryDays": max_carry, "annualBaseReset": annual_base}


# ── Contracts ─────────────────────────────────────────────────────────────────

VALID_CONTRACT_TYPES = {"PERMANENT", "FIXED_TERM", "PART_TIME", "PROBATION", "INTERNSHIP"}


class ContractCreate(BaseModel):
    contractType: str
    startDate: str
    endDate: Optional[str] = None
    renewalReminderDays: Optional[int] = 30
    notes: Optional[str] = None

    @field_validator("contractType")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v.upper() not in VALID_CONTRACT_TYPES:
            raise ValueError(f"contractType must be one of {sorted(VALID_CONTRACT_TYPES)}")
        return v.upper()


@router.get("/employees/{employee_id}/contracts")
def get_contracts(
    employee_id: str,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*HR_ROLES)),
):
    emp = db.query(models.Employee).filter(
        models.Employee.id == employee_id, models.Employee.deletedAt == None
    ).first()
    if not emp:
        raise HTTPException(404, "Employee not found")

    contracts = (
        db.query(models.EmployeeContract)
        .filter(models.EmployeeContract.employeeId == employee_id)
        .order_by(models.EmployeeContract.startDate.desc())
        .all()
    )
    return [
        {
            "id": c.id,
            "contractType": c.contractType,
            "startDate": c.startDate.isoformat() if c.startDate else None,
            "endDate": c.endDate.isoformat() if c.endDate else None,
            "renewalReminderDays": c.renewalReminderDays,
            "notes": c.notes,
            "isExpiringSoon": (
                c.endDate is not None and
                c.endDate.date() <= (datetime.now() + timedelta(days=c.renewalReminderDays or 30)).date()
                and c.endDate.date() >= datetime.now().date()
            ),
            "createdAt": c.createdAt.isoformat() if c.createdAt else None,
        }
        for c in contracts
    ]


@router.post("/employees/{employee_id}/contracts", status_code=201)
def create_contract(
    employee_id: str,
    body: ContractCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*HR_ROLES)),
):
    emp = db.query(models.Employee).filter(
        models.Employee.id == employee_id, models.Employee.deletedAt == None
    ).first()
    if not emp:
        raise HTTPException(404, "Employee not found")

    try:
        start = datetime.fromisoformat(body.startDate)
    except (ValueError, TypeError):
        raise HTTPException(422, "Invalid startDate format")

    end = None
    if body.endDate:
        try:
            end = datetime.fromisoformat(body.endDate)
        except (ValueError, TypeError):
            raise HTTPException(422, "Invalid endDate format")
        if end <= start:
            raise HTTPException(422, "endDate must be after startDate")

    contract = models.EmployeeContract(
        id=generate_id(),
        employeeId=employee_id,
        contractType=body.contractType,
        startDate=start,
        endDate=end,
        renewalReminderDays=body.renewalReminderDays,
        notes=sanitize_string(body.notes),
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    log_audit(db, user.id, "CREATE", "EmployeeContract", contract.id, {"contractType": body.contractType, "employeeId": employee_id})

    if emp.user and end:
        days_until_expiry = (end.date() - datetime.now().date()).days
        if days_until_expiry <= (body.renewalReminderDays or 30):
            _notify(
                db, emp.user.id,
                "Contract Expiring Soon",
                f"Your {body.contractType} contract expires in {days_until_expiry} day(s).",
                "WARNING",
                "/my-hr",
            )

    return {"id": contract.id, "contractType": contract.contractType, "startDate": contract.startDate.isoformat()}


# ── Phase 5 — Analytics & Intelligence ────────────────────────────────────────

@router.get("/reports/analytics")
def get_analytics(
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*HR_ROLES)),
):
    """Unified HR analytics endpoint — headcount, leave stats, payroll summary, contract alerts."""
    now = datetime.now()
    first_of_month = datetime(now.year, now.month, 1)
    start_of_year = datetime(now.year, 1, 1)

    # Headcount
    base = db.query(models.Employee).filter(models.Employee.deletedAt == None)
    total = base.count()
    active = base.filter(models.Employee.status == "ACTIVE").count()
    on_leave = base.filter(models.Employee.status == "ON_LEAVE").count()

    # Attrition this year
    attrition_this_year = db.query(func.count(models.Employee.id)).filter(
        models.Employee.deletedAt == None,
        models.Employee.status == "TERMINATED",
        models.Employee.endDate >= start_of_year,
    ).scalar() or 0

    # By department
    dept_rows = (
        db.query(models.Department.name, func.count(models.Employee.id).label("count"))
        .join(models.Employee, models.Employee.departmentId == models.Department.id)
        .filter(models.Employee.deletedAt == None, models.Employee.status != "TERMINATED")
        .group_by(models.Department.name)
        .order_by(func.count(models.Employee.id).desc())
        .all()
    )

    # By employment type
    type_rows = (
        db.query(models.Employee.employmentType, func.count(models.Employee.id).label("count"))
        .filter(models.Employee.deletedAt == None, models.Employee.status != "TERMINATED")
        .group_by(models.Employee.employmentType)
        .all()
    )

    # Leave stats
    pending_leaves = db.query(func.count(models.LeaveRequest.id)).filter(
        models.LeaveRequest.status == "PENDING"
    ).scalar() or 0

    approved_this_month = db.query(func.count(models.LeaveRequest.id)).filter(
        models.LeaveRequest.status == "APPROVED",
        models.LeaveRequest.approvedAt >= first_of_month,
    ).scalar() or 0

    leave_by_type = (
        db.query(models.LeaveRequest.type, func.count(models.LeaveRequest.id).label("count"))
        .group_by(models.LeaveRequest.type)
        .all()
    )

    # Payroll this month
    payroll_row = db.query(
        func.sum(models.Payroll.grossSalary).label("gross"),
        func.sum(models.Payroll.netSalary).label("net"),
        func.count(models.Payroll.id).label("count"),
    ).filter(models.Payroll.year == now.year, models.Payroll.month == now.month).first()

    # Contracts expiring in next 30 days
    thirty_days_out = now + timedelta(days=30)
    contracts_expiring = db.query(func.count(models.EmployeeContract.id)).filter(
        models.EmployeeContract.endDate != None,
        models.EmployeeContract.endDate >= now,
        models.EmployeeContract.endDate <= thirty_days_out,
    ).scalar() or 0

    # Headcount by month for last 12 months (join count of employees active at that month-start)
    headcount_trend = []
    for i in range(11, -1, -1):
        month_offset = now.month - i
        yr = now.year + (month_offset - 1) // 12
        mo = ((month_offset - 1) % 12) + 1
        month_start = datetime(yr, mo, 1)
        count = db.query(func.count(models.Employee.id)).filter(
            models.Employee.hireDate <= month_start,
            models.Employee.deletedAt == None,
            models.Employee.status != "TERMINATED",
        ).scalar() or 0
        headcount_trend.append({"month": f"{yr}-{mo:02d}", "count": count})

    return {
        "headcount": {"current": total, "active": active, "onLeave": on_leave},
        "attritionThisYear": attrition_this_year,
        "byDepartment": [{"name": r.name, "count": r.count} for r in dept_rows],
        "byType": {r.employmentType: r.count for r in type_rows},
        "leaveStats": {
            "pendingCount": pending_leaves,
            "approvedThisMonth": approved_this_month,
            "byType": [{"type": r.type, "count": r.count} for r in leave_by_type],
        },
        "payrollSummary": {
            "totalNetSalary": float(payroll_row.net or 0) if payroll_row else 0,
            "totalGrossSalary": float(payroll_row.gross or 0) if payroll_row else 0,
            "processedCount": int(payroll_row.count or 0) if payroll_row else 0,
        },
        "contractsExpiring": contracts_expiring,
        "headcountTrend": headcount_trend,
    }


# ── Leave Policies ─────────────────────────────────────────────────────────────

@router.get("/leave-policies")
def get_leave_policies(db: Session = Depends(get_db), _user=Depends(require_roles(*HR_ROLES))):
    policies = db.query(models.LeavePolicy).order_by(models.LeavePolicy.leaveType).all()
    return [
        {
            "id": p.id,
            "leaveType": p.leaveType,
            "maxDaysPerYear": p.maxDaysPerYear,
            "carryForwardMax": p.carryForwardMax,
            "requiresMedicalCert": p.requiresMedicalCert,
            "probationAllowed": p.probationAllowed,
            "minServiceDays": p.minServiceDays,
            "encashmentAllowed": p.encashmentAllowed,
        }
        for p in policies
    ]


# ── Phase 3 — Org Chart ────────────────────────────────────────────────────────

@router.get("/org-chart")
def get_org_chart(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    """Returns flat list of all active employees with hierarchy info — frontend builds the tree."""
    employees = (
        db.query(models.Employee)
        .filter(models.Employee.deletedAt == None, models.Employee.status != "TERMINATED")
        .options(
            joinedload(models.Employee.user),
            joinedload(models.Employee.department),
        )
        .all()
    )
    return [
        {
            "id": e.id,
            "name": e.user.name if e.user else "—",
            "jobTitle": e.jobTitle,
            "department": e.department.name if e.department else "—",
            "reportsToId": e.reportsToId,
            "status": e.status,
            "empCode": e.empCode,
        }
        for e in employees
    ]


# ── Phase 3 — Performance Reviews ─────────────────────────────────────────────

VALID_RATINGS = {1, 2, 3, 4, 5}
VALID_REVIEW_STATUSES = {"DRAFT", "SUBMITTED", "ACKNOWLEDGED"}


class ReviewCreate(BaseModel):
    employeeId: str
    period: str               # e.g. "2025-Q2"
    rating: int
    goals: Optional[list] = []
    strengths: Optional[str] = None
    improvements: Optional[str] = None
    comments: Optional[str] = None


class ReviewUpdate(BaseModel):
    rating: Optional[int] = None
    goals: Optional[list] = None
    strengths: Optional[str] = None
    improvements: Optional[str] = None
    comments: Optional[str] = None
    status: Optional[str] = None


def _review_to_dict(r: models.PerformanceReview) -> dict:
    return {
        "id": r.id,
        "employeeId": r.employeeId,
        "reviewerId": r.reviewerId,
        "reviewerName": r.reviewer.name if r.reviewer else None,
        "period": r.period,
        "rating": r.rating,
        "goals": r.goals or [],
        "strengths": r.strengths,
        "improvements": r.improvements,
        "comments": r.comments,
        "status": r.status,
        "createdAt": r.createdAt.isoformat() if r.createdAt else None,
    }


@router.get("/performance-reviews")
def list_reviews(
    employeeId: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*HR_ROLES)),
):
    q = db.query(models.PerformanceReview).options(joinedload(models.PerformanceReview.reviewer))
    if employeeId:
        q = q.filter(models.PerformanceReview.employeeId == employeeId)
    return [_review_to_dict(r) for r in q.order_by(models.PerformanceReview.period.desc()).all()]


@router.post("/performance-reviews", status_code=201)
def create_review(body: ReviewCreate, db: Session = Depends(get_db), user=Depends(require_roles(*HR_ROLES))):
    if body.rating not in VALID_RATINGS:
        raise HTTPException(422, "rating must be 1–5")
    emp = db.query(models.Employee).filter(models.Employee.id == body.employeeId, models.Employee.deletedAt == None).first()
    if not emp:
        raise HTTPException(404, "Employee not found")
    existing = db.query(models.PerformanceReview).filter(
        models.PerformanceReview.employeeId == body.employeeId,
        models.PerformanceReview.period == body.period,
    ).first()
    if existing:
        raise HTTPException(409, f"Review already exists for {body.period}")
    review = models.PerformanceReview(
        id=generate_id(),
        employeeId=body.employeeId,
        reviewerId=user.id,
        period=body.period,
        rating=body.rating,
        goals=body.goals or [],
        strengths=sanitize_string(body.strengths),
        improvements=sanitize_string(body.improvements),
        comments=sanitize_string(body.comments),
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    log_audit(db, user.id, "CREATE", "PerformanceReview", review.id, {"employeeId": body.employeeId, "period": body.period})
    return _review_to_dict(review)


@router.patch("/performance-reviews/{review_id}")
def update_review(review_id: str, body: ReviewUpdate, db: Session = Depends(get_db), user=Depends(require_roles(*HR_ROLES))):
    review = db.query(models.PerformanceReview).filter(models.PerformanceReview.id == review_id).first()
    if not review:
        raise HTTPException(404, "Review not found")
    if body.rating is not None and body.rating not in VALID_RATINGS:
        raise HTTPException(422, "rating must be 1–5")
    if body.status is not None and body.status not in VALID_REVIEW_STATUSES:
        raise HTTPException(422, f"status must be one of {sorted(VALID_REVIEW_STATUSES)}")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(review, field, sanitize_string(val) if isinstance(val, str) else val)
    db.commit()
    db.refresh(review)
    log_audit(db, user.id, "UPDATE", "PerformanceReview", review_id, {"period": review.period})
    return _review_to_dict(review)


@router.delete("/performance-reviews/{review_id}", status_code=204)
def delete_review(review_id: str, db: Session = Depends(get_db), user=Depends(require_roles(*HR_ROLES))):
    review = db.query(models.PerformanceReview).filter(models.PerformanceReview.id == review_id).first()
    if not review:
        raise HTTPException(404, "Review not found")
    db.delete(review)
    db.commit()
    log_audit(db, user.id, "DELETE", "PerformanceReview", review_id, {})


# ── Phase 3 — Employee Documents ──────────────────────────────────────────────

VALID_DOC_TYPES = {"NATIONAL_ID", "PASSPORT", "CERTIFICATE", "CONTRACT", "OFFER_LETTER", "OTHER"}


class DocumentCreate(BaseModel):
    name: str
    docType: str
    notes: Optional[str] = None
    expiryDate: Optional[str] = None

    @field_validator("docType")
    @classmethod
    def validate_type(cls, v: str) -> str:
        v = v.upper()
        if v not in VALID_DOC_TYPES:
            raise ValueError(f"docType must be one of {sorted(VALID_DOC_TYPES)}")
        return v


@router.get("/employees/{employee_id}/documents")
def list_documents(employee_id: str, db: Session = Depends(get_db), _user=Depends(require_roles(*HR_ROLES))):
    docs = (
        db.query(models.EmployeeDocument)
        .filter(models.EmployeeDocument.employeeId == employee_id)
        .options(joinedload(models.EmployeeDocument.uploadedBy))
        .order_by(models.EmployeeDocument.createdAt.desc())
        .all()
    )
    return [
        {
            "id": d.id,
            "name": d.name,
            "docType": d.docType,
            "notes": d.notes,
            "expiryDate": d.expiryDate.isoformat()[:10] if d.expiryDate else None,
            "uploadedBy": d.uploadedBy.name if d.uploadedBy else None,
            "createdAt": d.createdAt.isoformat() if d.createdAt else None,
            "isExpiringSoon": (
                d.expiryDate is not None and
                d.expiryDate.date() <= (datetime.now() + timedelta(days=30)).date() and
                d.expiryDate.date() >= datetime.now().date()
            ),
        }
        for d in docs
    ]


@router.post("/employees/{employee_id}/documents", status_code=201)
def create_document(
    employee_id: str,
    body: DocumentCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*HR_ROLES)),
):
    emp = db.query(models.Employee).filter(models.Employee.id == employee_id, models.Employee.deletedAt == None).first()
    if not emp:
        raise HTTPException(404, "Employee not found")
    expiry = None
    if body.expiryDate:
        try:
            expiry = datetime.fromisoformat(body.expiryDate)
        except (ValueError, TypeError):
            raise HTTPException(422, "Invalid expiryDate format")
    doc = models.EmployeeDocument(
        id=generate_id(),
        employeeId=employee_id,
        uploadedById=user.id,
        name=sanitize_string(body.name),
        docType=body.docType,
        notes=sanitize_string(body.notes),
        expiryDate=expiry,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    log_audit(db, user.id, "CREATE", "EmployeeDocument", doc.id, {"name": body.name, "docType": body.docType, "employeeId": employee_id})
    return {"id": doc.id, "name": doc.name, "docType": doc.docType, "createdAt": doc.createdAt.isoformat()}


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(document_id: str, db: Session = Depends(get_db), user=Depends(require_roles(*HR_ROLES))):
    doc = db.query(models.EmployeeDocument).filter(models.EmployeeDocument.id == document_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    db.delete(doc)
    db.commit()
    log_audit(db, user.id, "DELETE", "EmployeeDocument", document_id, {})
