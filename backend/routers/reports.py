from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from auth import get_current_user, require_roles
import models

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/overview")
def get_reports_overview(
    range: str = Query("this_month"),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("SUPER_ADMIN", "CLINIC_MANAGER", "ACCOUNTANT")),
):
    now = datetime.utcnow()
    if range == "last_year":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0)
        prev_start = start.replace(year=start.year - 1)
        prev_end = start
    elif range == "last_quarter":
        start = now - timedelta(days=90)
        prev_start = start - timedelta(days=90)
        prev_end = start
    elif range == "last_month":
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_end = first_of_month
        prev_month = first_of_month - timedelta(days=1)
        prev_start = prev_month.replace(day=1)
        start = prev_start
    else:  # this_month
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_end = start
        prev_month = start - timedelta(days=1)
        prev_start = prev_month.replace(day=1)

    revenue_mtd = float(
        db.query(func.sum(models.Payment.amount))
        .filter(models.Payment.paidAt >= start)
        .scalar() or 0
    )

    prev_revenue = float(
        db.query(func.sum(models.Payment.amount))
        .filter(models.Payment.paidAt >= prev_start, models.Payment.paidAt < prev_end)
        .scalar() or 0
    )

    appointments_mtd = (
        db.query(func.count(models.Appointment.id))
        .filter(models.Appointment.scheduledAt >= start)
        .scalar() or 0
    )

    prev_appointments = (
        db.query(func.count(models.Appointment.id))
        .filter(models.Appointment.scheduledAt >= prev_start, models.Appointment.scheduledAt < prev_end)
        .scalar() or 0
    )

    patients_mtd = (
        db.query(func.count(models.Patient.id))
        .filter(models.Patient.createdAt >= start)
        .scalar() or 0
    )

    prev_patients = (
        db.query(func.count(models.Patient.id))
        .filter(models.Patient.createdAt >= prev_start, models.Patient.createdAt < prev_end)
        .scalar() or 0
    )

    no_show_count = (
        db.query(func.count(models.Appointment.id))
        .filter(models.Appointment.scheduledAt >= start, models.Appointment.status == "NO_SHOW")
        .scalar() or 0
    )
    no_show_rate = round((no_show_count / appointments_mtd * 100), 1) if appointments_mtd > 0 else 0.0

    prev_no_show = (
        db.query(func.count(models.Appointment.id))
        .filter(models.Appointment.scheduledAt >= prev_start, models.Appointment.scheduledAt < prev_end, models.Appointment.status == "NO_SHOW")
        .scalar() or 0
    )
    prev_no_show_rate = round((prev_no_show / prev_appointments * 100), 1) if prev_appointments > 0 else 0.0

    def pct_change(current, previous):
        if previous == 0:
            return 0
        return round((current - previous) / previous * 100, 1)

    return {
        "revenueMTD": revenue_mtd,
        "patientsMTD": patients_mtd,
        "appointmentsMTD": appointments_mtd,
        "noShowRate": no_show_rate,
        "revenueChange": pct_change(revenue_mtd, prev_revenue),
        "patientsChange": pct_change(patients_mtd, prev_patients),
        "appointmentsChange": pct_change(appointments_mtd, prev_appointments),
        "noShowChange": pct_change(no_show_rate, prev_no_show_rate),
    }
