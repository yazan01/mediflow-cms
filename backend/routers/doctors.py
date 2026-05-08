from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/doctors", tags=["doctors"])


@router.get("")
def get_doctors(
    search: str = Query(""),
    specialization: Optional[str] = None,
    branch_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """
    Returns doctors who have an active Employee record in HR.
    Enriched with department, branch, and job title from HR.
    """
    query = (
        db.query(models.Doctor, models.Employee)
        .join(models.User, models.Doctor.userId == models.User.id)
        .join(
            models.Employee,
            models.Employee.userId == models.Doctor.userId,
        )
        .options(
            joinedload(models.Doctor.user),
            joinedload(models.Doctor.department),
        )
        .filter(
            models.Doctor.isAvailable == True,
            models.User.isActive == True,
            models.Employee.deletedAt == None,
            models.Employee.status == "ACTIVE",
        )
    )

    if search:
        query = query.filter(models.User.name.ilike(f"%{search}%"))

    if specialization and specialization != "ALL":
        query = query.filter(models.Doctor.specialization == specialization)

    if branch_id and branch_id != "ALL":
        query = query.filter(models.Employee.branchId == branch_id)

    rows = query.all()

    result = []
    seen_doctor_ids = set()
    for doc, emp in rows:
        if doc.id in seen_doctor_ids:
            continue
        seen_doctor_ids.add(doc.id)

        # Resolve branch name from employee
        branch_name = None
        if emp.branchId:
            br = db.query(models.Branch).filter(models.Branch.id == emp.branchId).first()
            branch_name = br.name if br else None

        # Prefer doctor's department, fall back to employee's department
        dept = doc.department or emp.department
        dept_name = dept.name if dept else None

        result.append({
            "id": doc.id,
            "userId": doc.userId,
            "name": doc.user.name if doc.user else "",
            "specialization": doc.specialization,
            "consultationFee": float(doc.consultationFee or 0),
            "isAvailable": doc.isAvailable,
            "licenseNumber": doc.licenseNumber,
            "department": {"name": dept_name} if dept_name else None,
            "departmentName": dept_name,
            "jobTitle": emp.jobTitle,
            "empCode": emp.empCode,
            "branchId": emp.branchId,
            "branchName": branch_name,
            "user": {"name": doc.user.name if doc.user else ""},
        })

    return result
