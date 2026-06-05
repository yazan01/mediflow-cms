from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_user, require_roles, generate_id, generate_invoice_no

CLINICAL_ROLES = ("SUPER_ADMIN", "CLINIC_MANAGER", "DOCTOR", "NURSE")
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


class LabOrderIn(BaseModel):
    tests: List[str]
    priority: Optional[str] = "ROUTINE"
    notes: Optional[str] = None


class RadiologyOrderIn(BaseModel):
    modality: str
    study: str
    bodyPart: str
    priority: Optional[str] = "ROUTINE"
    clinicalInfo: Optional[str] = None


class ConsultationCreate(BaseModel):
    appointmentId: str
    patientId: Optional[str] = None   # auto-filled from appointment if omitted
    doctorId: Optional[str] = None    # auto-filled from appointment if omitted
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
    labOrders: Optional[List[LabOrderIn]] = []
    radiologyOrders: Optional[List[RadiologyOrderIn]] = []


class ConsultationUpdate(BaseModel):
    chiefComplaint: Optional[str] = None
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    hpi: Optional[str] = None
    pmh: Optional[str] = None
    examination: Optional[str] = None
    followUpDate: Optional[str] = None
    isLocked: Optional[bool] = None
    vitals: Optional[VitalsIn] = None
    diagnoses: Optional[List[DiagnosisIn]] = None
    prescriptions: Optional[List[PrescriptionIn]] = None
    labOrders: Optional[List[LabOrderIn]] = None
    radiologyOrders: Optional[List[RadiologyOrderIn]] = None


def _consultation_detail(c: models.Consultation) -> dict:
    patient = c.patient
    doctor = c.doctor
    return {
        "id": c.id,
        "appointmentId": c.appointmentId,
        "branchId": c.appointment.branchId if c.appointment else None,
        "createdAt": c.createdAt.isoformat() if c.createdAt else None,
        "chiefComplaint": c.chiefComplaint,
        "subjective": c.subjective,
        "objective": c.objective,
        "assessment": c.assessment,
        "plan": c.plan,
        "hpi": c.hpi,
        "pmh": c.pmh,
        "examination": c.examination,
        "followUpDate": c.followUpDate.isoformat() if c.followUpDate else None,
        "isLocked": c.isLocked,
        "lockedAt": c.lockedAt.isoformat() if c.lockedAt else None,
        "patient": {
            "id": patient.id,
            "firstName": patient.firstName,
            "lastName": patient.lastName,
            "mrn": patient.mrn,
            "dateOfBirth": patient.dateOfBirth.isoformat() if patient.dateOfBirth else None,
            "gender": patient.gender,
            "phone": patient.phone,
            "allergies": patient.allergies or [],
            "bloodType": patient.bloodType,
        } if patient else None,
        "doctor": {
            "name": doctor.user.name if doctor and doctor.user else "",
            "specialization": doctor.specialization if doctor else "",
            "licenseNumber": doctor.licenseNumber if doctor else "",
        } if doctor else None,
        "vitals": {
            "bpSystolic": c.vitals.bpSystolic, "bpDiastolic": c.vitals.bpDiastolic,
            "heartRate": c.vitals.heartRate,
            "temperature": float(c.vitals.temperature) if c.vitals.temperature else None,
            "weight": float(c.vitals.weight) if c.vitals.weight else None,
            "height": float(c.vitals.height) if c.vitals.height else None,
            "bmi": float(c.vitals.bmi) if c.vitals.bmi else None,
            "spo2": float(c.vitals.spo2) if c.vitals.spo2 else None,
            "bloodGlucose": float(c.vitals.bloodGlucose) if c.vitals.bloodGlucose else None,
            "respiratoryRate": c.vitals.respiratoryRate,
        } if c.vitals else None,
        "diagnoses": [
            {"icdCode": d.icdCode, "description": d.description, "type": d.type}
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
        "labOrders": [
            {
                "id": lo.id,
                "tests": lo.tests or [],
                "priority": lo.priority,
                "status": lo.status,
                "notes": lo.notes,
            }
            for lo in (c.labOrders or [])
        ],
        "radiologyOrders": [
            {
                "id": ro.id,
                "modality": ro.modality,
                "study": ro.study,
                "bodyPart": ro.bodyPart,
                "priority": ro.priority,
                "status": ro.status,
            }
            for ro in (c.radiologyOrders or [])
        ],
    }


def _upsert_vitals(db: Session, consultation_id: str, v: VitalsIn):
    bmi = v.bmi
    if bmi is None and v.weight and v.height and v.height > 0:
        bmi = round(v.weight / ((v.height / 100) ** 2), 1)

    existing = db.query(models.Vitals).filter(
        models.Vitals.consultationId == consultation_id
    ).first()
    if existing:
        for field in ["bpSystolic", "bpDiastolic", "heartRate", "temperature",
                      "weight", "height", "spo2", "bloodGlucose", "respiratoryRate"]:
            val = getattr(v, field)
            if val is not None:
                setattr(existing, field, val)
        if bmi is not None:
            existing.bmi = bmi
    else:
        db.add(models.Vitals(
            id=generate_id(),
            consultationId=consultation_id,
            bpSystolic=v.bpSystolic,
            bpDiastolic=v.bpDiastolic,
            heartRate=v.heartRate,
            temperature=v.temperature,
            weight=v.weight,
            height=v.height,
            bmi=bmi,
            spo2=v.spo2,
            bloodGlucose=v.bloodGlucose,
            respiratoryRate=v.respiratoryRate,
        ))


@router.get("/{consultation_id}")
def get_consultation(consultation_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    c = db.query(models.Consultation).filter(models.Consultation.id == consultation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Consultation not found")
    return _consultation_detail(c)


@router.post("", status_code=201)
def create_consultation(
    body: ConsultationCreate,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*CLINICAL_ROLES)),
):
    # Look up appointment to fill patientId/doctorId
    appt = db.query(models.Appointment).filter(models.Appointment.id == body.appointmentId).first()
    if not appt:
        raise HTTPException(status_code=400, detail="Appointment not found")

    patientId = body.patientId or appt.patientId
    doctorId = body.doctorId or appt.doctorId

    if not patientId or not doctorId:
        raise HTTPException(status_code=400, detail="Could not determine patient and doctor from appointment")

    # Return existing consultation instead of creating a duplicate
    existing = db.query(models.Consultation).filter(
        models.Consultation.appointmentId == body.appointmentId
    ).first()
    if existing:
        return {
            "id": existing.id,
            "appointmentId": existing.appointmentId,
            "patientId": existing.patientId,
            "doctorId": existing.doctorId,
            "chiefComplaint": existing.chiefComplaint,
            "createdAt": existing.createdAt.isoformat() if existing.createdAt else None,
            "isLocked": existing.isLocked,
            "alreadyExists": True,
        }

    consultation = models.Consultation(
        id=generate_id(),
        appointmentId=body.appointmentId,
        patientId=patientId,
        doctorId=doctorId,
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
        _upsert_vitals(db, consultation.id, body.vitals)

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

    for lo in (body.labOrders or []):
        db.add(models.LabOrder(
            id=generate_id(),
            consultationId=consultation.id,
            patientId=patientId,
            orderedByDoctorId=doctorId,
            tests=lo.tests,
            priority=lo.priority or "ROUTINE",
            notes=lo.notes,
        ))

    for ro in (body.radiologyOrders or []):
        db.add(models.RadiologyOrder(
            id=generate_id(),
            consultationId=consultation.id,
            patientId=patientId,
            orderedByDoctorId=doctorId,
            modality=ro.modality,
            study=ro.study,
            bodyPart=ro.bodyPart,
            priority=ro.priority or "ROUTINE",
            clinicalInfo=ro.clinicalInfo,
        ))

    appt.status = "IN_CONSULTATION"

    db.commit()
    db.refresh(consultation)

    from auth import log_audit
    log_audit(db, _user.id, "CREATE", "Consultation", consultation.id, {"appointmentId": body.appointmentId})

    return {
        "id": consultation.id,
        "appointmentId": consultation.appointmentId,
        "patientId": consultation.patientId,
        "doctorId": consultation.doctorId,
        "chiefComplaint": consultation.chiefComplaint,
        "createdAt": consultation.createdAt.isoformat() if consultation.createdAt else None,
        "isLocked": consultation.isLocked,
        "alreadyExists": False,
    }


@router.patch("/{consultation_id}")
def update_consultation(
    consultation_id: str,
    body: ConsultationUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*CLINICAL_ROLES)),
):
    c = db.query(models.Consultation).filter(models.Consultation.id == consultation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Consultation not found")
    if c.isLocked:
        raise HTTPException(status_code=409, detail="Consultation is locked and cannot be edited")

    scalar_fields = ["chiefComplaint", "subjective", "objective", "assessment", "plan",
                     "hpi", "pmh", "examination", "followUpDate", "isLocked"]
    update_data = body.model_dump(exclude_none=True)

    for field in scalar_fields:
        if field in update_data:
            val = update_data[field]
            if field == "followUpDate" and val:
                val = datetime.fromisoformat(val)
            if field == "isLocked" and val and not c.isLocked:
                c.lockedAt = datetime.now()
            setattr(c, field, val)

    if "vitals" in update_data and body.vitals:
        _upsert_vitals(db, c.id, body.vitals)

    if "diagnoses" in update_data and body.diagnoses is not None:
        db.query(models.Diagnosis).filter(models.Diagnosis.consultationId == c.id).delete()
        for d in body.diagnoses:
            db.add(models.Diagnosis(
                id=generate_id(),
                consultationId=c.id,
                icdCode=d.icdCode,
                description=d.description,
                type=d.type or "PRIMARY",
            ))

    if "prescriptions" in update_data and body.prescriptions is not None:
        db.query(models.Prescription).filter(models.Prescription.consultationId == c.id).delete()
        for rx in body.prescriptions:
            db.add(models.Prescription(
                id=generate_id(),
                consultationId=c.id,
                medicationName=rx.medicationName,
                dosage=rx.dosage,
                frequency=rx.frequency,
                duration=rx.duration,
                quantity=rx.quantity,
                instructions=rx.instructions,
            ))

    if "labOrders" in update_data and body.labOrders is not None:
        for lo in body.labOrders:
            db.add(models.LabOrder(
                id=generate_id(),
                consultationId=c.id,
                patientId=c.patientId,
                orderedByDoctorId=c.doctorId,
                tests=lo.tests,
                priority=lo.priority or "ROUTINE",
                notes=lo.notes,
            ))

    if "radiologyOrders" in update_data and body.radiologyOrders is not None:
        for ro in body.radiologyOrders:
            db.add(models.RadiologyOrder(
                id=generate_id(),
                consultationId=c.id,
                patientId=c.patientId,
                orderedByDoctorId=c.doctorId,
                modality=ro.modality,
                study=ro.study,
                bodyPart=ro.bodyPart,
                priority=ro.priority or "ROUTINE",
                clinicalInfo=ro.clinicalInfo,
            ))

    db.commit()
    db.refresh(c)

    from auth import log_audit
    log_audit(db, _user.id, "UPDATE", "Consultation", c.id, {})

    return _consultation_detail(c)


@router.post("/{consultation_id}/lock")
def lock_consultation(
    consultation_id: str,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*CLINICAL_ROLES)),
):
    c = db.query(models.Consultation).filter(models.Consultation.id == consultation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Consultation not found")
    if c.isLocked:
        return {"success": True, "alreadyLocked": True, "invoiceId": None}

    c.isLocked = True
    c.lockedAt = datetime.now()

    # Auto-create invoice if appointment doesn't already have one
    invoice_id = None
    appt = c.appointment
    if appt and not appt.invoice:
        doctor = c.doctor
        fee = float(doctor.consultationFee) if (doctor and doctor.consultationFee) else 0

        items = []
        if fee > 0:
            items.append({"description": "Consultation Fee", "category": "CONSULTATION", "qty": 1, "price": fee})

        for lo in (c.labOrders or []):
            tests_str = ", ".join((lo.tests or [])[:3])
            items.append({"description": f"Lab: {tests_str}", "category": "LAB", "qty": 1, "price": 0})

        for ro in (c.radiologyOrders or []):
            items.append({"description": f"Radiology: {ro.study} ({ro.modality})", "category": "RADIOLOGY", "qty": 1, "price": 0})

        if not items:
            items.append({"description": "Consultation Fee", "category": "CONSULTATION", "qty": 1, "price": 0})

        subtotal = sum(it["price"] * it["qty"] for it in items)
        invoice = models.Invoice(
            id=generate_id(),
            invoiceNo=generate_invoice_no(db),
            patientId=c.patientId,
            appointmentId=c.appointmentId,
            subtotal=subtotal,
            discountAmount=0,
            taxAmount=0,
            totalAmount=subtotal,
            paidAmount=0,
            balance=subtotal,
            status="PENDING",
            insuranceClaim=False,
        )
        db.add(invoice)
        db.flush()
        invoice_id = invoice.id

        for it in items:
            db.add(models.InvoiceItem(
                id=generate_id(),
                invoiceId=invoice.id,
                description=it["description"],
                category=it["category"],
                quantity=it["qty"],
                unitPrice=it["price"],
                discount=0,
                totalPrice=it["price"] * it["qty"],
            ))

    # Mark appointment as COMPLETED
    if appt:
        appt.status = "COMPLETED"
        appt.completedAt = datetime.now()

    db.commit()

    from auth import log_audit
    log_audit(db, _user.id, "LOCK", "Consultation", consultation_id, {"invoiceId": invoice_id})

    return {"success": True, "alreadyLocked": False, "invoiceId": invoice_id}
