from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/overview")
def get_reports_overview(
    period: str = Query("month"),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    now = datetime.now()
    if period == "week":
        start = now - timedelta(days=7)
    elif period == "year":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0)
    else:
        start = now.replace(day=1, hour=0, minute=0, second=0)

    total_revenue = (
        db.query(func.sum(models.Payment.amount))
        .filter(models.Payment.paidAt >= start)
        .scalar() or 0
    )

    total_appointments = (
        db.query(func.count(models.Appointment.id))
        .filter(models.Appointment.scheduledAt >= start)
        .scalar() or 0
    )

    new_patients = (
        db.query(func.count(models.Patient.id))
        .filter(models.Patient.createdAt >= start)
        .scalar() or 0
    )

    invoice_breakdown = (
        db.query(models.Invoice.status, func.count(models.Invoice.id))
        .filter(models.Invoice.createdAt >= start)
        .group_by(models.Invoice.status)
        .all()
    )

    return {
        "period": period,
        "totalRevenue": float(total_revenue),
        "totalAppointments": total_appointments,
        "newPatients": new_patients,
        "invoiceBreakdown": {status: count for status, count in invoice_breakdown},
    }
