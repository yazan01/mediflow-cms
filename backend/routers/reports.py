# backend/routers/reports.py
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
import io
import csv

from database import get_db
from auth import get_current_user, require_roles
import models

router = APIRouter(prefix="/api/reports", tags=["reports"])

REPORT_ROLES = ("SUPER_ADMIN", "CLINIC_MANAGER", "ACCOUNTANT")


def _parse_date(value: Optional[str], field: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def _build_stats(db: Session, start: datetime, end: Optional[datetime], prev_start: datetime, prev_end: datetime, doctor_id: Optional[str] = None, branch_id: Optional[str] = None):
    now = end or datetime.utcnow()

    pay_q = db.query(func.sum(models.Payment.amount)).filter(models.Payment.paidAt >= start)
    if end:
        pay_q = pay_q.filter(models.Payment.paidAt < end)
    revenue_mtd = float(pay_q.scalar() or 0)

    prev_rev = float(
        db.query(func.sum(models.Payment.amount))
        .filter(models.Payment.paidAt >= prev_start, models.Payment.paidAt < prev_end)
        .scalar() or 0
    )

    appt_q = db.query(func.count(models.Appointment.id)).filter(models.Appointment.scheduledAt >= start)
    if end:
        appt_q = appt_q.filter(models.Appointment.scheduledAt < end)
    if doctor_id:
        appt_q = appt_q.filter(models.Appointment.doctorId == doctor_id)
    if branch_id:
        appt_q = appt_q.filter(models.Appointment.branchId == branch_id)
    appointments_mtd = appt_q.scalar() or 0

    prev_appt_q = db.query(func.count(models.Appointment.id)).filter(
        models.Appointment.scheduledAt >= prev_start, models.Appointment.scheduledAt < prev_end
    )
    if doctor_id:
        prev_appt_q = prev_appt_q.filter(models.Appointment.doctorId == doctor_id)
    prev_appointments = prev_appt_q.scalar() or 0

    pat_q = db.query(func.count(models.Patient.id)).filter(models.Patient.createdAt >= start)
    if end:
        pat_q = pat_q.filter(models.Patient.createdAt < end)
    patients_mtd = pat_q.scalar() or 0

    prev_pat = db.query(func.count(models.Patient.id)).filter(
        models.Patient.createdAt >= prev_start, models.Patient.createdAt < prev_end
    ).scalar() or 0

    ns_q = db.query(func.count(models.Appointment.id)).filter(
        models.Appointment.scheduledAt >= start, models.Appointment.status == "NO_SHOW"
    )
    if end:
        ns_q = ns_q.filter(models.Appointment.scheduledAt < end)
    no_show_count = ns_q.scalar() or 0
    no_show_rate = round((no_show_count / appointments_mtd * 100), 1) if appointments_mtd > 0 else 0.0

    prev_ns = db.query(func.count(models.Appointment.id)).filter(
        models.Appointment.scheduledAt >= prev_start, models.Appointment.scheduledAt < prev_end, models.Appointment.status == "NO_SHOW"
    ).scalar() or 0
    prev_ns_rate = round((prev_ns / prev_appointments * 100), 1) if prev_appointments > 0 else 0.0

    def pct(cur, prev):
        if prev == 0:
            return 0
        return round((cur - prev) / prev * 100, 1)

    return {
        "revenueMTD": revenue_mtd,
        "patientsMTD": patients_mtd,
        "appointmentsMTD": appointments_mtd,
        "noShowRate": no_show_rate,
        "revenueChange": pct(revenue_mtd, prev_rev),
        "patientsChange": pct(patients_mtd, prev_pat),
        "appointmentsChange": pct(appointments_mtd, prev_appointments),
        "noShowChange": pct(no_show_rate, prev_ns_rate),
    }


@router.get("/overview")
def get_reports_overview(
    range: str = Query("this_month"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    doctor_id: Optional[str] = Query(None),
    branch_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*REPORT_ROLES)),
):
    now = datetime.utcnow()

    # Custom date range overrides the preset range
    if date_from:
        start = _parse_date(date_from, "date_from") or now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = _parse_date(date_to, "date_to")
        period_days = (end - start).days if end else (now - start).days
        prev_start = start - timedelta(days=period_days or 30)
        prev_end = start
    elif range == "last_year":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end = None
        prev_start = start.replace(year=start.year - 1)
        prev_end = start
    elif range == "last_quarter":
        start = now - timedelta(days=90)
        end = None
        prev_start = start - timedelta(days=90)
        prev_end = start
    elif range == "last_month":
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_end = first_of_month
        prev_month = first_of_month - timedelta(days=1)
        prev_start = prev_month.replace(day=1)
        start = prev_start
        end = prev_end
    else:  # this_month
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = None
        prev_end = start
        prev_month = start - timedelta(days=1)
        prev_start = prev_month.replace(day=1)

    return _build_stats(db, start, end, prev_start, prev_end, doctor_id, branch_id)


@router.get("/export")
def export_report(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    format: str = Query("csv"),
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*REPORT_ROLES)),
):
    now = datetime.utcnow()
    start = _parse_date(date_from, "date_from") or now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end = _parse_date(date_to, "date_to") or now

    payments = (
        db.query(models.Payment, models.Invoice, models.Patient)
        .join(models.Invoice, models.Payment.invoiceId == models.Invoice.id)
        .join(models.Patient, models.Invoice.patientId == models.Patient.id)
        .filter(models.Payment.paidAt >= start, models.Payment.paidAt < end)
        .order_by(models.Payment.paidAt.asc())
        .all()
    )

    rows = [["Invoice No", "Patient", "Amount", "Method", "Date"]]
    for pay, inv, pat in payments:
        rows.append([
            inv.invoiceNo,
            f"{pat.firstName} {pat.lastName}",
            str(float(pay.amount)),
            pay.method or "",
            pay.paidAt.strftime("%Y-%m-%d %H:%M") if pay.paidAt else "",
        ])

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerows(rows)
    output.seek(0)

    filename = f"report_{start.strftime('%Y%m%d')}_{end.strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
