from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
from auth import get_current_user, generate_id, generate_mrn, sanitize_string, log_audit
import models

router = APIRouter(prefix="/api/patients", tags=["patients"])

VALID_GENDERS = {"MALE", "FEMALE"}
VALID_BLOOD_TYPES = {"A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"}


class PatientCreate(BaseModel):
    firstName: str = Field(..., min_length=1, max_length=100)
    lastName: str = Field(..., min_length=1, max_length=100)
    dateOfBirth: str = Field(..., max_length=30)
    gender: str = Field(..., max_length=10)
    phone: str = Field(..., max_length=30)
    nationality: Optional[str] = Field(None, max_length=60)
    nationalId: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=150)
    address: Optional[str] = Field(None, max_length=500)
    bloodType: Optional[str] = Field(None, max_length=10)
    allergies: Optional[List[str]] = []
    chronicConditions: Optional[List[str]] = []
    emergencyContactName: Optional[str] = Field(None, max_length=150)
    emergencyContactPhone: Optional[str] = Field(None, max_length=30)
    insuranceProvider: Optional[str] = Field(None, max_length=150)
    insurancePolicyNo: Optional[str] = Field(None, max_length=60)
    insuranceCoverageType: Optional[str] = Field(None, max_length=60)
    insuranceExpiry: Optional[str] = Field(None, max_length=30)
    notes: Optional[str] = Field(None, max_length=2000)


class PatientUpdate(BaseModel):
    firstName: Optional[str] = Field(None, min_length=1, max_length=100)
    lastName: Optional[str] = Field(None, min_length=1, max_length=100)
    dateOfBirth: Optional[str] = Field(None, max_length=30)
    gender: Optional[str] = Field(None, max_length=10)
    nationality: Optional[str] = Field(None, max_length=60)
    nationalId: Optional[str] = Field(None, max_length=50)
    phone: Optional[str] = Field(None, max_length=30)
    email: Optional[str] = Field(None, max_length=150)
    address: Optional[str] = Field(None, max_length=500)
    bloodType: Optional[str] = Field(None, max_length=10)
    allergies: Optional[List[str]] = None
    chronicConditions: Optional[List[str]] = None
    emergencyContactName: Optional[str] = Field(None, max_length=150)
    emergencyContactPhone: Optional[str] = Field(None, max_length=30)
    insuranceProvider: Optional[str] = Field(None, max_length=150)
    insurancePolicyNo: Optional[str] = Field(None, max_length=60)
    insuranceCoverageType: Optional[str] = Field(None, max_length=60)
    insuranceExpiry: Optional[str] = Field(None, max_length=30)
    notes: Optional[str] = Field(None, max_length=2000)
    isActive: Optional[bool] = None


def patient_to_dict(p: models.Patient) -> dict:
    return {
        "id": p.id,
        "mrn": p.mrn,
        "firstName": p.firstName,
        "lastName": p.lastName,
        "dateOfBirth": p.dateOfBirth.isoformat() if p.dateOfBirth else None,
        "gender": p.gender,
        "phone": p.phone,
        "email": p.email,
        "bloodType": p.bloodType,
        "allergies": p.allergies or [],
        "chronicConditions": p.chronicConditions or [],
        "insuranceProvider": p.insuranceProvider,
        "isActive": p.isActive,
        "photo": p.photo,
        "lastVisit": p.lastVisit.isoformat() if p.lastVisit else None,
        "nationality": p.nationality,
        "nationalId": p.nationalId,
        "address": p.address,
        "emergencyContactName": p.emergencyContactName,
        "emergencyContactPhone": p.emergencyContactPhone,
        "insurancePolicyNo": p.insurancePolicyNo,
        "insuranceCoverageType": p.insuranceCoverageType,
        "insuranceExpiry": p.insuranceExpiry.isoformat() if p.insuranceExpiry else None,
        "notes": p.notes,
        "createdAt": p.createdAt.isoformat() if p.createdAt else None,
    }


def _parse_date(value: str, field_name: str) -> datetime:
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail=f"Invalid date format for {field_name}: {value!r}")


@router.get("")
def get_patients(
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    search: str = Query(""),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    # Never return soft-deleted records
    query = db.query(models.Patient).filter(models.Patient.deletedAt == None)  # noqa: E711

    if search:
        query = query.filter(
            or_(
                models.Patient.firstName.contains(search),
                models.Patient.lastName.contains(search),
                models.Patient.mrn.contains(search),
                models.Patient.phone.contains(search),
                models.Patient.nationalId.contains(search),
                models.Patient.email.contains(search),
            )
        )

    if status and status != "ALL":
        query = query.filter(models.Patient.isActive == (status == "ACTIVE"))

    total = query.count()
    data = query.order_by(models.Patient.createdAt.desc()).offset((page - 1) * pageSize).limit(pageSize).all()

    return {
        "data": [patient_to_dict(p) for p in data],
        "total": total,
        "page": page,
        "pageSize": pageSize,
        "totalPages": -(-total // pageSize),
    }


@router.post("", status_code=201)
def create_patient(body: PatientCreate, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    if body.gender not in VALID_GENDERS:
        raise HTTPException(status_code=422, detail=f"Invalid gender. Must be one of: {', '.join(VALID_GENDERS)}")

    if body.bloodType and body.bloodType not in VALID_BLOOD_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid blood type: {body.bloodType!r}")

    if body.nationalId:
        existing = db.query(models.Patient).filter(models.Patient.nationalId == body.nationalId).first()
        if existing:
            raise HTTPException(status_code=409, detail="A patient with this national ID already exists")

    dob = _parse_date(body.dateOfBirth, "dateOfBirth")
    ins_expiry = _parse_date(body.insuranceExpiry, "insuranceExpiry") if body.insuranceExpiry else None

    try:
        patient = models.Patient(
            id=generate_id(),
            mrn=generate_mrn(db),
            firstName=sanitize_string(body.firstName),
            lastName=sanitize_string(body.lastName),
            dateOfBirth=dob,
            gender=body.gender,
            nationality=sanitize_string(body.nationality),
            nationalId=sanitize_string(body.nationalId),
            phone=sanitize_string(body.phone),
            email=sanitize_string(body.email),
            address=sanitize_string(body.address),
            bloodType=body.bloodType or None,
            allergies=body.allergies or [],
            chronicConditions=body.chronicConditions or [],
            emergencyContactName=sanitize_string(body.emergencyContactName),
            emergencyContactPhone=sanitize_string(body.emergencyContactPhone),
            insuranceProvider=sanitize_string(body.insuranceProvider),
            insurancePolicyNo=sanitize_string(body.insurancePolicyNo),
            insuranceCoverageType=sanitize_string(body.insuranceCoverageType),
            insuranceExpiry=ins_expiry,
            notes=sanitize_string(body.notes),
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create patient record")

    return patient_to_dict(patient)


@router.get("/{patient_id}")
def get_patient(patient_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    p = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")

    base = patient_to_dict(p)

    appointments = []
    for a in sorted(p.appointments, key=lambda x: x.scheduledAt, reverse=True):
        doc_name = None
        if a.doctor and a.doctor.user:
            doc_name = a.doctor.user.name
        appointments.append({
            "id": a.id,
            "scheduledAt": a.scheduledAt.isoformat() if a.scheduledAt else None,
            "status": a.status,
            "type": a.type,
            "reason": a.reason,
            "doctor": {"user": {"name": doc_name}} if doc_name else None,
        })

    consultations = []
    for c in sorted(p.consultations, key=lambda x: x.createdAt, reverse=True):
        consultations.append({
            "id": c.id,
            "createdAt": c.createdAt.isoformat() if c.createdAt else None,
            "chiefComplaint": c.chiefComplaint,
            "subjective": c.subjective,
            "assessment": c.assessment,
            "plan": c.plan,
            "isLocked": c.isLocked,
        })

    invoices = []
    for inv in sorted(p.invoices, key=lambda x: x.createdAt, reverse=True):
        invoices.append({
            "id": inv.id,
            "invoiceNo": inv.invoiceNo,
            "createdAt": inv.createdAt.isoformat() if inv.createdAt else None,
            "totalAmount": float(inv.totalAmount),
            "paidAmount": float(inv.paidAmount),
            "balance": float(inv.balance),
            "status": inv.status,
        })

    return {**base, "appointments": appointments, "consultations": consultations, "invoices": invoices}


# Explicit safe field list — prevents mass assignment
_PATIENT_UPDATE_FIELDS = {
    "firstName", "lastName", "dateOfBirth", "gender", "nationality", "nationalId",
    "phone", "email", "address", "bloodType", "allergies", "chronicConditions",
    "emergencyContactName", "emergencyContactPhone", "insuranceProvider",
    "insurancePolicyNo", "insuranceCoverageType", "insuranceExpiry", "notes", "isActive",
}


@router.patch("/{patient_id}")
def update_patient(
    patient_id: str,
    body: PatientUpdate,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if body.gender is not None and body.gender not in VALID_GENDERS:
        raise HTTPException(status_code=422, detail=f"Invalid gender: {body.gender!r}")

    if body.bloodType is not None and body.bloodType and body.bloodType not in VALID_BLOOD_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid blood type: {body.bloodType!r}")

    updates = body.model_dump(exclude_none=True)

    STRING_FIELDS = {
        "firstName", "lastName", "nationality", "nationalId", "phone", "email",
        "address", "emergencyContactName", "emergencyContactPhone",
        "insuranceProvider", "insurancePolicyNo", "insuranceCoverageType", "notes",
    }

    try:
        for field, value in updates.items():
            if field not in _PATIENT_UPDATE_FIELDS:
                continue
            if field == "insuranceExpiry":
                value = _parse_date(value, "insuranceExpiry")
            elif field == "dateOfBirth":
                value = _parse_date(value, "dateOfBirth")
            elif field in STRING_FIELDS and isinstance(value, str):
                value = sanitize_string(value)
            setattr(patient, field, value)
        db.commit()
        db.refresh(patient)
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update patient record")

    return patient_to_dict(patient)


@router.delete("/{patient_id}")
def delete_patient(patient_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    patient = db.query(models.Patient).filter(
        models.Patient.id == patient_id,
        models.Patient.deletedAt == None,  # noqa: E711
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    patient.isActive = False
    patient.deletedAt = datetime.utcnow()
    db.commit()
    log_audit(db, _user.id, "DELETE", "PATIENTS", entity_id=patient_id, entity_type="Patient")
    return {"success": True}
