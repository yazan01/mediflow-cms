# backend/routers/search.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/search", tags=["search"])

SEARCH_RATE = "30/minute"


@router.get("")
def global_search(
    q: str = Query("", min_length=1, max_length=200),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not q or len(q.strip()) < 1:
        return {"results": []}

    user_roles = set(current_user.roles if isinstance(current_user.roles, list) else [])
    results = []

    # Patients
    patients = (
        db.query(models.Patient)
        .filter(
            models.Patient.deletedAt == None,
            or_(
                models.Patient.firstName.ilike(f"%{q}%"),
                models.Patient.lastName.ilike(f"%{q}%"),
                models.Patient.mrn.ilike(f"%{q}%"),
                models.Patient.phone.ilike(f"%{q}%"),
            ),
        )
        .limit(limit)
        .all()
    )
    for p in patients:
        results.append({
            "type": "patient",
            "id": p.id,
            "title": f"{p.firstName} {p.lastName}",
            "subtitle": f"MRN: {p.mrn} · {p.phone or ''}",
            "url": f"/patients/{p.id}",
        })

    # Appointments
    appts = (
        db.query(models.Appointment, models.Patient)
        .join(models.Patient, models.Appointment.patientId == models.Patient.id)
        .filter(
            or_(
                models.Patient.firstName.ilike(f"%{q}%"),
                models.Patient.lastName.ilike(f"%{q}%"),
                models.Appointment.reason.ilike(f"%{q}%"),
            )
        )
        .limit(limit)
        .all()
    )
    for a, p in appts:
        results.append({
            "type": "appointment",
            "id": a.id,
            "title": f"{p.firstName} {p.lastName}",
            "subtitle": f"{a.status} · {a.scheduledAt.strftime('%Y-%m-%d %H:%M') if a.scheduledAt else ''}",
            "url": f"/appointments/{a.id}",
        })

    # Invoices
    if user_roles & {"SUPER_ADMIN", "CLINIC_MANAGER", "ACCOUNTANT", "RECEPTIONIST"}:
        invoices = (
            db.query(models.Invoice, models.Patient)
            .join(models.Patient, models.Invoice.patientId == models.Patient.id)
            .filter(
                or_(
                    models.Invoice.invoiceNo.ilike(f"%{q}%"),
                    models.Patient.firstName.ilike(f"%{q}%"),
                    models.Patient.lastName.ilike(f"%{q}%"),
                )
            )
            .limit(limit)
            .all()
        )
        for inv, p in invoices:
            results.append({
                "type": "invoice",
                "id": inv.id,
                "title": inv.invoiceNo,
                "subtitle": f"{p.firstName} {p.lastName} · {inv.status}",
                "url": f"/billing",
            })

    # Medications
    if user_roles & {"SUPER_ADMIN", "CLINIC_MANAGER", "PHARMACIST"}:
        meds = (
            db.query(models.Medication)
            .filter(
                models.Medication.isActive == True,
                or_(
                    models.Medication.brandName.ilike(f"%{q}%"),
                    models.Medication.genericName.ilike(f"%{q}%"),
                ),
            )
            .limit(limit)
            .all()
        )
        for m in meds:
            results.append({
                "type": "medication",
                "id": m.id,
                "title": m.brandName or m.genericName or "",
                "subtitle": f"{m.genericName or ''} · Qty: {m.stockQuantity}",
                "url": "/pharmacy",
            })

    # Employees (HR only)
    if user_roles & {"SUPER_ADMIN", "CLINIC_MANAGER", "HR_OFFICER"}:
        emps = (
            db.query(models.Employee, models.User)
            .join(models.User, models.Employee.userId == models.User.id)
            .filter(
                or_(
                    models.User.name.ilike(f"%{q}%"),
                    models.User.email.ilike(f"%{q}%"),
                )
            )
            .limit(limit)
            .all()
        )
        for e, u in emps:
            results.append({
                "type": "employee",
                "id": e.id,
                "title": u.name,
                "subtitle": f"{e.jobTitle or ''} · {u.email}",
                "url": "/hr",
            })

    # Deduplicate by id+type and limit total
    seen = set()
    unique = []
    for r in results:
        key = f"{r['type']}:{r['id']}"
        if key not in seen:
            seen.add(key)
            unique.append(r)
        if len(unique) >= limit:
            break

    return {"results": unique}
