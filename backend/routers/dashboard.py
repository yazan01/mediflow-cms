import calendar
import os
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

    wa_configured = bool(
        os.getenv("TWILIO_SID") and os.getenv("TWILIO_TOKEN") and os.getenv("TWILIO_WA_FROM")
    )

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
        "whatsappConfigured": wa_configured,
    }


@router.get("/revenue")
def get_revenue_chart(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    today = datetime.now()
    result = []
    for i in range(5, -1, -1):
        year = today.year
        month = today.month - i
        while month <= 0:
            month += 12
            year -= 1
        month_start = datetime(year, month, 1)
        last_day = calendar.monthrange(year, month)[1]
        month_end = datetime(year, month, last_day, 23, 59, 59)

        revenue = float(
            db.query(func.sum(models.Payment.amount))
            .filter(models.Payment.paidAt >= month_start, models.Payment.paidAt <= month_end)
            .scalar() or 0
        )
        expenses = float(
            db.query(func.sum(models.Expense.amount))
            .filter(models.Expense.date >= month_start, models.Expense.date <= month_end)
            .scalar() or 0
        )
        result.append({
            "month": month_start.strftime("%b"),
            "revenue": round(revenue, 2),
            "expenses": round(expenses, 2),
        })
    return result


@router.get("/departments")
def get_department_load(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)

    rows = (
        db.query(models.Department.name, func.count(models.Appointment.id).label("count"))
        .join(models.Doctor, models.Doctor.departmentId == models.Department.id)
        .join(models.Appointment, models.Appointment.doctorId == models.Doctor.id)
        .filter(
            models.Appointment.scheduledAt >= today,
            models.Appointment.scheduledAt < tomorrow,
            models.Appointment.status != "CANCELLED",
        )
        .group_by(models.Department.name)
        .order_by(func.count(models.Appointment.id).desc())
        .limit(6)
        .all()
    )

    total = sum(r.count for r in rows) or 1
    return [
        {"department": r.name, "count": r.count, "pct": round((r.count / total) * 100)}
        for r in rows
    ]
