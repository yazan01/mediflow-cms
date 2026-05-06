from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_user, generate_id
import models

router = APIRouter(prefix="/api/consultations", tags=["consultations"])


class VitalsIn(BaseModel):
    bpSystolic: Optional[int] = None
    bpDiastolic: Optional[int] = None
    heartRate: Optional[int] = None
    temperature: Optional[float] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    bmi: Optional[float] = None
    spo2: Optional[float] = None
    bloodGlucose: Optional[float] = None
    respiratoryRate: Optional[int] = None


class DiagnosisIn(BaseModel):
    icdCode: str
    description: str
    type: Optional[str] = "PRIMARY"


class PrescriptionIn(BaseModel):
    medicationName: str
    dosage: str
    frequency: str
    duration: str
    quantity: Optional[int] = None
    instructions: Optional[str] = None


class ConsultationCreate(BaseModel):
    appointmentId: str
    patientId: str
    doctorId: str
    chiefComplaint: Optional[str] = None
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    hpi: Optional[str] = None
    pmh: Optional[str] = None
    examination: Optional[str] = None
    followUpDate: Optional[str] = None
    vitals: Optional[VitalsIn] = None
    diagnoses: Optional[List[DiagnosisIn]] = []
    prescriptions: Optional[List[PrescriptionIn]] = []


@router.post("", status_code=201)
def create_consultation(
    body: ConsultationCreate,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    if not all([body.appointmentId, body.patientId, body.doctorId]):
        raise HTTPException(status_code=400, detail="appointmentId, patientId, and doctorId are required")

    consultation = models.Consultation(
        id=generate_id(),
        appointmentId=body.appointmentId,
        patientId=body.patientId,
        doctorId=body.doctorId,
        chiefComplaint=body.chiefComplaint,
        subjective=body.subjective,
        objective=body.objective,
        assessment=body.assessment,
        plan=body.plan,
        hpi=body.hpi,
        pmh=body.pmh,
        examination=body.examination,
        followUpDate=datetime.fromisoformat(body.followUpDate) if body.followUpDate else None,
    )
    db.add(consultation)
    db.flush()

    if body.vitals:
        v = body.vitals
        vitals = models.Vitals(
            id=generate_id(),
            consultationId=consultation.id,
            bpSystolic=v.bpSystolic,
            bpDiastolic=v.bpDiastolic,
            heartRate=v.heartRate,
            temperature=v.temperature,
            weight=v.weight,
            height=v.height,
            bmi=v.bmi,
            spo2=v.spo2,
            bloodGlucose=v.bloodGlucose,
            respiratoryRate=v.respiratoryRate,
        )
        db.add(vitals)

    for d in (body.diagnoses or []):
        db.add(models.Diagnosis(
            id=generate_id(),
            consultationId=consultation.id,
            icdCode=d.icdCode,
            description=d.description,
            type=d.type or "PRIMARY",
        ))

    for rx in (body.prescriptions or []):
        db.add(models.Prescription(
            id=generate_id(),
            consultationId=consultation.id,
            medicationName=rx.medicationName,
            dosage=rx.dosage,
            frequency=rx.frequency,
            duration=rx.duration,
            quantity=rx.quantity,
            instructions=rx.instructions,
        ))

    appt = db.query(models.Appointment).filter(models.Appointment.id == body.appointmentId).first()
    if appt:
        appt.status = "IN_CONSULTATION"

    db.commit()
    db.refresh(consultation)

    return {
        "id": consultation.id,
        "appointmentId": consultation.appointmentId,
        "patientId": consultation.patientId,
        "doctorId": consultation.doctorId,
        "chiefComplaint": consultation.chiefComplaint,
        "createdAt": consultation.createdAt.isoformat() if consultation.createdAt else None,
    }
