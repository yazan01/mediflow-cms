from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List

from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

# Role-based visibility
STOCK_ROLES    = {"SUPER_ADMIN", "CLINIC_MANAGER", "PHARMACIST"}
APPT_ROLES     = {"SUPER_ADMIN", "CLINIC_MANAGER", "DOCTOR", "NURSE", "RECEPTIONIST"}
LAB_ROLES      = {"SUPER_ADMIN", "CLINIC_MANAGER", "DOCTOR", "LAB_TECHNICIAN"}
INVOICE_ROLES  = {"SUPER_ADMIN", "CLINIC_MANAGER", "ACCOUNTANT"}


def _has_role(user_roles: List[str], allowed: set) -> bool:
    return bool(set(user_roles) & allowed)


@router.get("")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    now = datetime.now()
    user_roles: List[str] = current_user.roles if isinstance(current_user.roles, list) else []
    items = []

    # ── Low Stock ──────────────────────────────────────────────────────────────
    if _has_role(user_roles, STOCK_ROLES):
        low_stock = (
            db.query(models.Medication)
            .filter(
                models.Medication.isActive == True,
                models.Medication.minStockLevel > 0,
                models.Medication.stockQuantity <= models.Medication.minStockLevel,
            )
            .order_by(models.Medication.stockQuantity.asc())
            .limit(5)
            .all()
        )
        for med in low_stock:
            med_name = med.brandName or med.genericName
            items.append({
                "id": f"low_stock_{med.id}",
                "type": "LOW_STOCK",
                "icon": "warning",
                "iconColor": "#d97706",
                "title": "lowStock",
                "titleData": med_name,
                "message": "lowStockMsg",
                "messageData": {"name": med_name, "qty": med.stockQuantity, "min": med.minStockLevel},
                "link": "/pharmacy",
                "createdAt": now.isoformat(),
                "unread": True,
            })

    # ── Urgent Appointments (today) ────────────────────────────────────────────
    if _has_role(user_roles, APPT_ROLES):
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)

        appt_query = (
            db.query(models.Appointment, models.Patient)
            .join(models.Patient, models.Appointment.patientId == models.Patient.id)
            .filter(
                models.Appointment.isUrgent == True,
                models.Appointment.status.in_(["SCHEDULED", "CHECKED_IN"]),
                models.Appointment.scheduledAt >= today_start,
                models.Appointment.scheduledAt < today_end,
            )
            .order_by(models.Appointment.scheduledAt.asc())
        )

        # Doctors only see their own urgent appointments
        if "DOCTOR" in user_roles and not _has_role(user_roles, {"SUPER_ADMIN", "CLINIC_MANAGER", "NURSE", "RECEPTIONIST"}):
            doctor = db.query(models.Doctor).filter(models.Doctor.userId == current_user.id).first()
            if doctor:
                appt_query = appt_query.filter(models.Appointment.doctorId == doctor.id)
            else:
                appt_query = appt_query.filter(False)

        for appt, patient in appt_query.limit(5).all():
            items.append({
                "id": f"urgent_appt_{appt.id}",
                "type": "URGENT_APPT",
                "icon": "emergency",
                "iconColor": "#ba1a1a",
                "title": "urgentAppt",
                "titleData": None,
                "message": "urgentApptMsg",
                "messageData": {
                    "name": f"{patient.firstName} {patient.lastName}",
                    "room": appt.room or "—",
                },
                "link": f"/appointments/{appt.id}",
                "createdAt": appt.scheduledAt.isoformat(),
                "unread": True,
            })

    # ── Lab Results Ready ──────────────────────────────────────────────────────
    if _has_role(user_roles, LAB_ROLES):
        lab_query = (
            db.query(models.LabOrder, models.Patient)
            .join(models.Patient, models.LabOrder.patientId == models.Patient.id)
            .filter(
                models.LabOrder.status == "RESULTS_READY",
                models.LabOrder.createdAt >= now - timedelta(days=7),
            )
            .order_by(models.LabOrder.createdAt.desc())
        )

        # Doctors only see results for their own orders
        if "DOCTOR" in user_roles and not _has_role(user_roles, {"SUPER_ADMIN", "CLINIC_MANAGER", "LAB_TECHNICIAN"}):
            doctor = db.query(models.Doctor).filter(models.Doctor.userId == current_user.id).first()
            if doctor:
                lab_query = lab_query.filter(models.LabOrder.orderedByDoctorId == doctor.id)
            else:
                lab_query = lab_query.filter(False)

        for order, patient in lab_query.limit(5).all():
            tests_list = order.tests if isinstance(order.tests, list) else []
            test_names = ", ".join(str(t) for t in tests_list[:2]) if tests_list else "Lab"
            items.append({
                "id": f"lab_ready_{order.id}",
                "type": "LAB_READY",
                "icon": "biotech",
                "iconColor": "#1960a3",
                "title": "labResults",
                "titleData": None,
                "message": "labResultsMsg",
                "messageData": {
                    "name": f"{patient.firstName} {patient.lastName}",
                    "tests": test_names,
                },
                "link": f"/emr/{patient.id}",
                "createdAt": order.createdAt.isoformat() if order.createdAt else now.isoformat(),
                "unread": True,
            })

    # ── Overdue Invoices ───────────────────────────────────────────────────────
    if _has_role(user_roles, INVOICE_ROLES):
        overdue = (
            db.query(models.Invoice, models.Patient)
            .join(models.Patient, models.Invoice.patientId == models.Patient.id)
            .filter(
                models.Invoice.dueDate < now,
                models.Invoice.status.notin_(["PAID", "CANCELLED"]),
            )
            .order_by(models.Invoice.dueDate.asc())
            .limit(5)
            .all()
        )
        for inv, patient in overdue:
            days_overdue = (now - inv.dueDate).days
            items.append({
                "id": f"overdue_{inv.id}",
                "type": "OVERDUE_INVOICE",
                "icon": "payments",
                "iconColor": "#ba1a1a",
                "title": "overdueInvoice",
                "titleData": None,
                "message": "overdueInvoiceMsg",
                "messageData": {
                    "invoiceNo": inv.invoiceNo,
                    "days": days_overdue,
                },
                "link": f"/billing/{inv.id}",
                "createdAt": inv.dueDate.isoformat(),
                "unread": True,
            })

    # Sort: urgent types first, then by createdAt
    PRIORITY = {"URGENT_APPT": 0, "LOW_STOCK": 1, "LAB_READY": 2, "OVERDUE_INVOICE": 3}
    items.sort(key=lambda x: (PRIORITY.get(x["type"], 9), x["createdAt"]))
    items = items[:20]

    return {"data": items, "total": len(items)}
