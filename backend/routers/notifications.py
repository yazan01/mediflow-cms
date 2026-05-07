from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
def get_notifications(db: Session = Depends(get_db), _=Depends(get_current_user)):
    now = datetime.now()
    items = []

    # Low stock medications
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
        items.append({
            "id": f"low_stock_{med.id}",
            "type": "LOW_STOCK",
            "icon": "warning",
            "iconColor": "#d97706",
            "title": "low_stock",
            "titleData": med.name,
            "message": "low_stock_msg",
            "messageData": {"name": med.name, "qty": med.stockQuantity, "min": med.minStockLevel},
            "link": "/pharmacy",
            "createdAt": now.isoformat(),
            "unread": True,
        })

    # Urgent appointments today
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    urgent_appts = (
        db.query(models.Appointment, models.Patient)
        .join(models.Patient, models.Appointment.patientId == models.Patient.id)
        .filter(
            models.Appointment.isUrgent == True,
            models.Appointment.status.in_(["SCHEDULED", "CHECKED_IN"]),
            models.Appointment.scheduledAt >= today_start,
            models.Appointment.scheduledAt < today_end,
        )
        .order_by(models.Appointment.scheduledAt.asc())
        .limit(5)
        .all()
    )
    for appt, patient in urgent_appts:
        items.append({
            "id": f"urgent_appt_{appt.id}",
            "type": "URGENT_APPT",
            "icon": "emergency",
            "iconColor": "#ba1a1a",
            "title": "urgent_appt",
            "titleData": None,
            "message": "urgent_appt_msg",
            "messageData": {
                "name": f"{patient.firstName} {patient.lastName}",
                "room": appt.room or "—",
            },
            "link": f"/appointments/{appt.id}",
            "createdAt": appt.scheduledAt.isoformat(),
            "unread": True,
        })

    # Lab results ready (not yet reviewed — created in last 7 days)
    lab_ready = (
        db.query(models.LabOrder, models.Patient)
        .join(models.Patient, models.LabOrder.patientId == models.Patient.id)
        .filter(
            models.LabOrder.status == "RESULTS_READY",
            models.LabOrder.createdAt >= now - timedelta(days=7),
        )
        .order_by(models.LabOrder.createdAt.desc())
        .limit(5)
        .all()
    )
    for order, patient in lab_ready:
        tests_list = order.tests if isinstance(order.tests, list) else []
        test_names = ", ".join(tests_list[:2]) if tests_list else "Lab"
        items.append({
            "id": f"lab_ready_{order.id}",
            "type": "LAB_READY",
            "icon": "biotech",
            "iconColor": "#1960a3",
            "title": "lab_ready",
            "titleData": None,
            "message": "lab_ready_msg",
            "messageData": {
                "name": f"{patient.firstName} {patient.lastName}",
                "tests": test_names,
            },
            "link": f"/emr/{patient.id}",
            "createdAt": order.createdAt.isoformat() if order.createdAt else now.isoformat(),
            "unread": True,
        })

    # Overdue invoices
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
            "title": "overdue_invoice",
            "titleData": None,
            "message": "overdue_invoice_msg",
            "messageData": {
                "invoiceNo": inv.invoiceNo,
                "days": days_overdue,
            },
            "link": f"/billing/{inv.id}",
            "createdAt": inv.dueDate.isoformat(),
            "unread": True,
        })

    # Sort: urgent first, then by createdAt desc — limit to 20
    items.sort(key=lambda x: (0 if x["type"] in ("URGENT_APPT", "LOW_STOCK") else 1, x["createdAt"]), reverse=False)
    items = items[:20]

    return {"data": items, "total": len(items)}
