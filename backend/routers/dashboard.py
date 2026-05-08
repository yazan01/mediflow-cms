import calendar
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from auth import get_current_user, require_roles
import models

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

DASHBOARD_ROLES = (
    "SUPER_ADMIN", "CLINIC_MANAGER", "DOCTOR", "NURSE",
    "RECEPTIONIST", "ACCOUNTANT", "HR_OFFICER", "AUDITOR",
)


@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db), _user=Depends(require_roles(*DASHBOARD_ROLES))):
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

    wa_configured = safe(lambda: db.query(models.WhatsAppConfig).filter(
        models.WhatsAppConfig.isActive == True,
        models.WhatsAppConfig.isVerified == True,
    ).count() > 0)

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
def get_revenue_chart(db: Session = Depends(get_db), _user=Depends(require_roles(*DASHBOARD_ROLES))):
    today = datetime.now()
    # Compute start of the 6-month window
    yr, mo = today.year, today.month - 5
    while mo <= 0:
        mo += 12
        yr -= 1
    period_start = datetime(yr, mo, 1)

    # 2 aggregate queries instead of 12
    revenue_rows = (
        db.query(
            func.year(models.Payment.paidAt).label("yr"),
            func.month(models.Payment.paidAt).label("mo"),
            func.sum(models.Payment.amount).label("total"),
        )
        .filter(models.Payment.paidAt >= period_start, models.Payment.paidAt <= today)
        .group_by(func.year(models.Payment.paidAt), func.month(models.Payment.paidAt))
        .all()
    )
    revenue_map = {(int(r.yr), int(r.mo)): float(r.total) for r in revenue_rows}

    expense_rows = (
        db.query(
            func.year(models.Expense.date).label("yr"),
            func.month(models.Expense.date).label("mo"),
            func.sum(models.Expense.amount).label("total"),
        )
        .filter(models.Expense.date >= period_start, models.Expense.date <= today)
        .group_by(func.year(models.Expense.date), func.month(models.Expense.date))
        .all()
    )
    expense_map = {(int(r.yr), int(r.mo)): float(r.total) for r in expense_rows}

    result = []
    for i in range(5, -1, -1):
        y, m = today.year, today.month - i
        while m <= 0:
            m += 12
            y -= 1
        result.append({
            "month": datetime(y, m, 1).strftime("%b"),
            "revenue": round(revenue_map.get((y, m), 0.0), 2),
            "expenses": round(expense_map.get((y, m), 0.0), 2),
        })
    return result


@router.get("/departments")
def get_department_load(db: Session = Depends(get_db), _user=Depends(require_roles(*DASHBOARD_ROLES))):
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
