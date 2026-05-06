from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from database import get_db
from auth import get_current_user, generate_id
import models

router = APIRouter(prefix="/api/appointments", tags=["appointments"])


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
    }


@router.get("")
def get_appointments(
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    doctorId: Optional[str] = None,
    date: Optional[str] = None,
    patientId: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = db.query(models.Appointment)

    if status and status != "ALL":
        query = query.filter(models.Appointment.status == status)
    if doctorId and doctorId != "ALL":
        query = query.filter(models.Appointment.doctorId == doctorId)
    if patientId:
        query = query.filter(models.Appointment.patientId == patientId)

    if date:
        if date == "today":
            d = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            d = datetime.fromisoformat(date).replace(hour=0, minute=0, second=0, microsecond=0)
        next_day = d + timedelta(days=1)
        query = query.filter(and_(models.Appointment.scheduledAt >= d, models.Appointment.scheduledAt < next_day))

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

    start = datetime.fromisoformat(body.scheduledAt)
    end = datetime.fromisoformat(body.scheduledEnd) if body.scheduledEnd else start + timedelta(minutes=30)

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
        reason=body.reason,
        room=body.room,
        notes=body.notes,
        isUrgent=body.isUrgent or False,
        isWalkIn=body.isWalkIn or False,
    )
    db.add(appointment)

    patient = db.query(models.Patient).filter(models.Patient.id == body.patientId).first()
    if patient:
        patient.lastVisit = datetime.now()

    db.commit()
    db.refresh(appointment)
    return appt_to_dict(appointment)


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

    allowed = ["status", "notes", "room", "checkedInAt", "completedAt", "cancelledAt", "cancelReason"]
    for field in allowed:
        if field in body:
            setattr(appt, field, body[field])

    db.commit()
    db.refresh(appt)
    return appt_to_dict(appt)
