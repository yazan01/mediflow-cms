from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_

from database import get_db
from auth import get_current_user, generate_id, sanitize_string
import models

router = APIRouter(prefix="/api/appointments", tags=["appointments"])

VALID_STATUSES = {
    "SCHEDULED", "CHECKED_IN", "IN_CONSULTATION", "COMPLETED",
    "NO_SHOW", "CANCELLED", "RESCHEDULED", "URGENT",
}
VALID_TYPES = {
    "CONSULTATION", "FOLLOW_UP", "PROCEDURE", "LAB_VISIT",
    "IMAGING", "EMERGENCY", "DENTAL", "CHECKUP",
}


def _parse_dt(value: str, field: str) -> datetime:
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail=f"Invalid datetime format for {field}: {value!r}")


class AppointmentCreate(BaseModel):
    patientId: str
    doctorId: str
    scheduledAt: str
    scheduledEnd: Optional[str] = None
    type: Optional[str] = "CONSULTATION"
    reason: Optional[str] = None
    room: Optional[str] = None
    notes: Optional[str] = None
    isUrgent: Optional[bool] = False
    isWalkIn: Optional[bool] = False
    branchId: Optional[str] = None


def appt_to_dict(a: models.Appointment) -> dict:
    return {
        "id": a.id,
        "patientId": a.patientId,
        "patientName": f"{a.patient.firstName} {a.patient.lastName}" if a.patient else "",
        "mrn": a.patient.mrn if a.patient else "",
        "doctorId": a.doctorId,
        "doctorName": a.doctor.user.name if a.doctor and a.doctor.user else "",
        "specialization": a.doctor.specialization if a.doctor else "",
        "scheduledAt": a.scheduledAt.isoformat() if a.scheduledAt else None,
        "scheduledEnd": a.scheduledEnd.isoformat() if a.scheduledEnd else None,
        "status": a.status,
        "type": a.type,
        "reason": a.reason,
        "room": a.room,
        "notes": a.notes,
        "isUrgent": a.isUrgent,
        "checkedInAt": a.checkedInAt.isoformat() if a.checkedInAt else None,
        "createdAt": a.createdAt.isoformat() if a.createdAt else None,
        "branchId": a.branchId,
        "branchName": a.branch.name if hasattr(a, "branch") and a.branch else None,
    }


@router.get("/config")
def get_appointment_config(
    branch_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Return AppointmentConfig for a branch (or global defaults if not set)."""
    cfg = None
    if branch_id:
        cfg = db.query(models.AppointmentConfig).filter(
            models.AppointmentConfig.branchId == branch_id
        ).first()
    if cfg:
        return {
            "branchId": cfg.branchId,
            "startTime": cfg.startTime or "08:00",
            "endTime": cfg.endTime or "17:00",
            "workingDays": cfg.workingDays or ["MON", "TUE", "WED", "THU", "FRI"],
            "slotDuration": cfg.slotDurationMin or 30,
        }
    return {
        "branchId": branch_id,
        "startTime": "08:00",
        "endTime": "17:00",
        "workingDays": ["MON", "TUE", "WED", "THU", "FRI"],
        "slotDuration": 30,
    }


@router.get("")
def get_appointments(
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=500),
    status: Optional[str] = None,
    doctorId: Optional[str] = None,
    date: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    patientId: Optional[str] = None,
    branch_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = db.query(models.Appointment).options(
        joinedload(models.Appointment.patient),
        joinedload(models.Appointment.doctor).joinedload(models.Doctor.user),
        joinedload(models.Appointment.branch),
    )

    if status and status != "ALL":
        query = query.filter(models.Appointment.status == status)
    if doctorId and doctorId != "ALL":
        query = query.filter(models.Appointment.doctorId == doctorId)
    if patientId:
        query = query.filter(models.Appointment.patientId == patientId)
    if branch_id and branch_id != "ALL":
        query = query.filter(models.Appointment.branchId == branch_id)

    if date:
        if date == "today":
            d = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            d = _parse_dt(date, "date").replace(hour=0, minute=0, second=0, microsecond=0)
        next_day = d + timedelta(days=1)
        query = query.filter(and_(models.Appointment.scheduledAt >= d, models.Appointment.scheduledAt < next_day))
    elif startDate or endDate:
        if startDate:
            query = query.filter(models.Appointment.scheduledAt >= _parse_dt(startDate, "startDate"))
        if endDate:
            query = query.filter(models.Appointment.scheduledAt < _parse_dt(endDate, "endDate"))

    total = query.count()
    appointments = (
        query.order_by(models.Appointment.scheduledAt.asc())
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .all()
    )

    return {
        "data": [appt_to_dict(a) for a in appointments],
        "total": total,
        "page": page,
        "pageSize": pageSize,
        "totalPages": -(-total // pageSize),
    }


@router.post("", status_code=201)
def create_appointment(
    body: AppointmentCreate,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    if not all([body.patientId, body.doctorId, body.scheduledAt]):
        raise HTTPException(status_code=400, detail="Patient, doctor, and scheduled time are required")

    if body.type and body.type not in VALID_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid appointment type: {body.type!r}")

    start = _parse_dt(body.scheduledAt, "scheduledAt")
    end = _parse_dt(body.scheduledEnd, "scheduledEnd") if body.scheduledEnd else start + timedelta(minutes=30)

    conflicting = (
        db.query(models.Appointment)
        .filter(
            models.Appointment.doctorId == body.doctorId,
            models.Appointment.status.notin_(["CANCELLED", "RESCHEDULED"]),
            models.Appointment.scheduledAt < end,
            or_(
                models.Appointment.scheduledEnd == None,
                models.Appointment.scheduledEnd > start,
            ),
        )
        .first()
    )

    if conflicting:
        raise HTTPException(
            status_code=409,
            detail="This time slot is already booked for this doctor. Please choose another slot.",
        )

    appointment = models.Appointment(
        id=generate_id(),
        patientId=body.patientId,
        doctorId=body.doctorId,
        scheduledAt=start,
        scheduledEnd=end,
        type=body.type or "CONSULTATION",
        reason=sanitize_string(body.reason),
        room=sanitize_string(body.room),
        notes=sanitize_string(body.notes),
        isUrgent=body.isUrgent or False,
        isWalkIn=body.isWalkIn or False,
        branchId=body.branchId,
    )
    db.add(appointment)

    patient = db.query(models.Patient).filter(models.Patient.id == body.patientId).first()
    if patient:
        patient.lastVisit = datetime.now()

    db.commit()
    db.refresh(appointment)
    return appt_to_dict(appointment)


@router.get("/{appointment_id}")
def get_appointment(appointment_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    data = appt_to_dict(appt)
    # Include consultation info
    if appt.consultation:
        data["consultationId"] = appt.consultation.id
        data["consultationLocked"] = appt.consultation.isLocked
        data["chiefComplaint"] = appt.consultation.chiefComplaint
        data["assessment"] = appt.consultation.assessment
    else:
        data["consultationId"] = None
        data["consultationLocked"] = False
    # Include invoice info
    if appt.invoice:
        data["invoiceId"] = appt.invoice.id
        data["invoiceNo"] = appt.invoice.invoiceNo
        data["invoiceStatus"] = appt.invoice.status
        data["invoiceTotal"] = float(appt.invoice.totalAmount)
    else:
        data["invoiceId"] = None
    # Include full patient details
    if appt.patient:
        data["patientPhone"] = appt.patient.phone
        data["patientDob"] = appt.patient.dateOfBirth.isoformat() if appt.patient.dateOfBirth else None
        data["patientBloodType"] = appt.patient.bloodType
        data["patientAllergies"] = appt.patient.allergies or []
        data["patientChronicConditions"] = appt.patient.chronicConditions or []
    return data


@router.patch("/{appointment_id}")
def update_appointment(
    appointment_id: str,
    body: dict,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if "status" in body:
        if body["status"] not in VALID_STATUSES:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid status {body['status']!r}. Must be one of: {', '.join(sorted(VALID_STATUSES))}",
            )

    allowed_fields = {"status", "notes", "room", "checkedInAt", "completedAt", "cancelledAt", "cancelReason"}
    try:
        for field in allowed_fields:
            if field in body:
                value = body[field]
                if field in {"notes", "room", "cancelReason"} and isinstance(value, str):
                    value = sanitize_string(value)
                setattr(appt, field, value)
        db.commit()
        db.refresh(appt)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update appointment")

    return appt_to_dict(appt)


@router.post("/{appointment_id}/remind")
def send_reminder(
    appointment_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    import os
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if not appt.patient or not appt.patient.phone:
        raise HTTPException(status_code=400, detail="Patient has no phone number on record")

    doctor_name = appt.doctor.user.name if appt.doctor and appt.doctor.user else "your doctor"
    specialization = appt.doctor.specialization if appt.doctor else ""
    scheduled = appt.scheduledAt.strftime("%A, %d %B %Y at %H:%M") if appt.scheduledAt else "your scheduled time"
    patient_name = f"{appt.patient.firstName}" if appt.patient else "Dear Patient"

    # WhatsApp-formatted message (supports *bold* and line breaks)
    message = (
        f"🏥 *Appointment Reminder*\n\n"
        f"Dear {patient_name},\n\n"
        f"This is a reminder that you have an appointment:\n\n"
        f"👨‍⚕️ *Doctor:* Dr. {doctor_name}"
        + (f" — {specialization}" if specialization else "") + "\n"
        f"📅 *Date & Time:* {scheduled}\n\n"
        f"Please arrive *10 minutes early* and bring your ID and insurance card.\n\n"
        f"To reschedule or cancel, please contact us as soon as possible.\n\n"
        f"_Thank you for choosing our clinic._"
    )

    # Normalise phone to international format (assume +962 if starts with 07)
    raw_phone = appt.patient.phone.strip().replace(" ", "").replace("-", "")
    if raw_phone.startswith("07"):
        raw_phone = "+962" + raw_phone[1:]
    elif raw_phone.startswith("7") and len(raw_phone) == 9:
        raw_phone = "+962" + raw_phone
    elif not raw_phone.startswith("+"):
        raw_phone = "+" + raw_phone

    wa_to   = f"whatsapp:{raw_phone}"
    sid     = os.getenv("TWILIO_SID", "")
    token   = os.getenv("TWILIO_TOKEN", "")
    wa_from = os.getenv("TWILIO_WA_FROM", "")   # e.g. whatsapp:+14155238886
    sent = False
    error_msg = None

    if sid and token and wa_from:
        try:
            from twilio.rest import Client
            client = Client(sid, token)
            client.messages.create(body=message, from_=wa_from, to=wa_to)
            sent = True
        except Exception as e:
            error_msg = str(e)

    from auth import log_audit
    log_audit(db, current_user.id, "WHATSAPP_SENT" if sent else "WHATSAPP_PREVIEW",
              "appointments", appointment_id, "Appointment")

    return {
        "sent": sent,
        "phone": raw_phone,
        "message": message,
        "error": error_msg,
        "configured": bool(sid and token and wa_from),
    }
