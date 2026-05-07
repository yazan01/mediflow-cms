from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload, selectinload

from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/emr", tags=["emr"])


def vitals_dict(v) -> dict:
    if not v:
        return None
    return {
        "id": v.id,
        "bpSystolic": v.bpSystolic, "bpDiastolic": v.bpDiastolic,
        "heartRate": v.heartRate, "temperature": float(v.temperature) if v.temperature else None,
        "weight": float(v.weight) if v.weight else None,
        "height": float(v.height) if v.height else None,
        "bmi": float(v.bmi) if v.bmi else None,
        "spo2": float(v.spo2) if v.spo2 else None,
        "bloodGlucose": float(v.bloodGlucose) if v.bloodGlucose else None,
        "respiratoryRate": v.respiratoryRate,
        "recordedAt": v.recordedAt.isoformat() if v.recordedAt else None,
    }


@router.get("/{patient_id}")
def get_emr(patient_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    consultations = (
        db.query(models.Consultation)
        .options(
            joinedload(models.Consultation.doctor).joinedload(models.Doctor.user),
            joinedload(models.Consultation.appointment),
            joinedload(models.Consultation.vitals),
            selectinload(models.Consultation.diagnoses),
            selectinload(models.Consultation.prescriptions),
        )
        .filter(models.Consultation.patientId == patient_id)
        .order_by(models.Consultation.createdAt.desc())
        .limit(20)
        .all()
    )

    lab_orders = (
        db.query(models.LabOrder)
        .options(selectinload(models.LabOrder.results))
        .filter(models.LabOrder.patientId == patient_id)
        .order_by(models.LabOrder.createdAt.desc())
        .limit(20)
        .all()
    )

    radiology_orders = (
        db.query(models.RadiologyOrder)
        .filter(models.RadiologyOrder.patientId == patient_id)
        .order_by(models.RadiologyOrder.createdAt.desc())
        .limit(10)
        .all()
    )

    patient_data = {
        "id": patient.id,
        "mrn": patient.mrn,
        "firstName": patient.firstName,
        "lastName": patient.lastName,
        "dateOfBirth": patient.dateOfBirth.isoformat() if patient.dateOfBirth else None,
        "gender": patient.gender,
        "bloodType": patient.bloodType,
        "allergies": patient.allergies or [],
        "chronicConditions": patient.chronicConditions or [],
        "phone": patient.phone,
        "email": patient.email,
        "insuranceProvider": patient.insuranceProvider,
        "isActive": bool(patient.isActive),
        "photo": patient.photo,
        "nationality": patient.nationality,
        "address": patient.address,
    }

    consultations_data = [
        {
            "id": c.id,
            "chiefComplaint": c.chiefComplaint,
            "subjective": c.subjective,
            "objective": c.objective,
            "assessment": c.assessment,
            "plan": c.plan,
            "followUpDate": c.followUpDate.isoformat() if c.followUpDate else None,
            "isLocked": c.isLocked,
            "createdAt": c.createdAt.isoformat() if c.createdAt else None,
            "vitals": vitals_dict(c.vitals),
            "diagnoses": [
                {"id": d.id, "icdCode": d.icdCode, "description": d.description, "type": d.type}
                for d in c.diagnoses
            ],
            "prescriptions": [
                {
                    "id": rx.id,
                    "medicationName": rx.medicationName,
                    "dosage": rx.dosage,
                    "frequency": rx.frequency,
                    "duration": rx.duration,
                    "quantity": rx.quantity,
                    "instructions": rx.instructions,
                    "isDispensed": rx.isDispensed,
                }
                for rx in c.prescriptions
            ],
            "doctor": {"name": c.doctor.user.name if c.doctor and c.doctor.user else ""},
            "appointment": {
                "scheduledAt": c.appointment.scheduledAt.isoformat() if c.appointment and c.appointment.scheduledAt else None,
                "type": c.appointment.type if c.appointment else None,
            },
        }
        for c in consultations
    ]

    vitals_list = [
        vitals_dict(c.vitals)
        for c in consultations
        if c.vitals
    ]

    lab_data = [
        {
            "id": lo.id,
            "tests": lo.tests or [],
            "priority": lo.priority,
            "status": lo.status,
            "orderedBy": "",
            "date": lo.createdAt.isoformat() if lo.createdAt else None,
            "createdAt": lo.createdAt.isoformat() if lo.createdAt else None,
            "results": [
                {
                    "id": r.id,
                    "testName": r.testName,
                    "value": r.value,
                    "unit": r.unit,
                    "referenceRange": r.referenceRange,
                    "isAbnormal": r.isAbnormal,
                    "isCritical": r.isCritical,
                }
                for r in lo.results
            ],
        }
        for lo in lab_orders
    ]

    radiology_data = [
        {
            "id": ro.id,
            "modality": ro.modality,
            "study": ro.study,
            "bodyPart": ro.bodyPart,
            "priority": ro.priority,
            "status": ro.status,
            "report": ro.report,
            "createdAt": ro.createdAt.isoformat() if ro.createdAt else None,
        }
        for ro in radiology_orders
    ]

    return {
        "patient": patient_data,
        "consultations": consultations_data,
        "vitals": vitals_list,
        "labOrders": lab_data,
        "radiologyOrders": radiology_data,
    }


@router.get("/{patient_id}/consultations")
def get_patient_consultations(patient_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    consultations = (
        db.query(models.Consultation)
        .options(
            joinedload(models.Consultation.doctor).joinedload(models.Doctor.user),
            joinedload(models.Consultation.appointment),
            joinedload(models.Consultation.vitals),
            selectinload(models.Consultation.diagnoses),
            selectinload(models.Consultation.prescriptions),
        )
        .filter(models.Consultation.patientId == patient_id)
        .order_by(models.Consultation.createdAt.desc())
        .all()
    )

    return [
        {
            "id": c.id,
            "chiefComplaint": c.chiefComplaint,
            "subjective": c.subjective,
            "objective": c.objective,
            "assessment": c.assessment,
            "plan": c.plan,
            "hpi": c.hpi,
            "examination": c.examination,
            "followUpDate": c.followUpDate.isoformat() if c.followUpDate else None,
            "isLocked": c.isLocked,
            "createdAt": c.createdAt.isoformat() if c.createdAt else None,
            "vitals": vitals_dict(c.vitals),
            "diagnoses": [
                {"id": d.id, "icdCode": d.icdCode, "description": d.description, "type": d.type}
                for d in c.diagnoses
            ],
            "prescriptions": [
                {
                    "id": rx.id,
                    "medicationName": rx.medicationName,
                    "dosage": rx.dosage,
                    "frequency": rx.frequency,
                    "duration": rx.duration,
                    "quantity": rx.quantity,
                    "instructions": rx.instructions,
                    "isDispensed": rx.isDispensed,
                }
                for rx in c.prescriptions
            ],
            "doctor": {"name": c.doctor.user.name if c.doctor and c.doctor.user else ""},
            "appointment": {
                "scheduledAt": c.appointment.scheduledAt.isoformat() if c.appointment and c.appointment.scheduledAt else None,
                "type": c.appointment.type if c.appointment else None,
            },
        }
        for c in consultations
    ]
