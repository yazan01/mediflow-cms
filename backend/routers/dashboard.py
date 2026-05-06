from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    yesterday = today - timedelta(days=1)

    def safe(fn):
        try:
            return fn()
        except Exception:
            return 0

    daily_revenue = safe(lambda: float(
        db.query(func.sum(models.Payment.amount))
        .filter(models.Payment.paidAt >= today, models.Payment.paidAt < tomorrow)
        .scalar() or 0
    ))
    prev_revenue = safe(lambda: float(
        db.query(func.sum(models.Payment.amount))
        .filter(models.Payment.paidAt >= yesterday, models.Payment.paidAt < today)
        .scalar() or 0
    ))

    today_appts = safe(lambda: db.query(func.count(models.Appointment.id)).filter(
        models.Appointment.scheduledAt >= today,
        models.Appointment.scheduledAt < tomorrow,
        models.Appointment.status != "CANCELLED",
    ).scalar() or 0)
    yest_appts = safe(lambda: db.query(func.count(models.Appointment.id)).filter(
        models.Appointment.scheduledAt >= yesterday,
        models.Appointment.scheduledAt < today,
        models.Appointment.status != "CANCELLED",
    ).scalar() or 0)

    new_patients = safe(lambda: db.query(func.count(models.Patient.id)).filter(
        models.Patient.createdAt >= today, models.Patient.createdAt < tomorrow
    ).scalar() or 0)
    prev_patients = safe(lambda: db.query(func.count(models.Patient.id)).filter(
        models.Patient.createdAt >= yesterday, models.Patient.createdAt < today
    ).scalar() or 0)

    pending_invoices = safe(lambda: db.query(func.count(models.Invoice.id)).filter(
        models.Invoice.status.in_(["PENDING", "OVERDUE"])
    ).scalar() or 0)

    out_of_stock = safe(lambda: db.query(func.count(models.Medication.id)).filter(
        models.Medication.isActive == True, models.Medication.stockQuantity == 0
    ).scalar() or 0)

    low_stock = safe(lambda: db.query(func.count(models.Medication.id)).filter(
        models.Medication.isActive == True,
        models.Medication.stockQuantity > 0,
        models.Medication.stockQuantity <= models.Medication.reorderLevel,
    ).scalar() or 0)

    waiting = safe(lambda: db.query(func.count(models.Appointment.id)).filter(
        models.Appointment.scheduledAt >= today,
        models.Appointment.scheduledAt < tomorrow,
        models.Appointment.status == "CHECKED_IN",
    ).scalar() or 0)

    def pct_change(curr, prev):
        if prev == 0:
            return 0
        return round(((curr - prev) / prev) * 100)

    return {
        "dailyRevenue": daily_revenue,
        "dailyRevenueChange": pct_change(daily_revenue, prev_revenue),
        "totalAppointments": today_appts,
        "appointmentsChange": pct_change(today_appts, yest_appts),
        "newPatients": new_patients,
        "newPatientsChange": pct_change(new_patients, prev_patients),
        "bedOccupancy": 0,
        "bedOccupancyChange": 0,
        "pendingInvoices": pending_invoices,
        "criticalAlerts": out_of_stock,
        "lowStockItems": low_stock,
        "waitingPatients": waiting,
    }
