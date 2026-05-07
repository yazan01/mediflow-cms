from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
from auth import get_current_user, generate_id, generate_mrn
import models

router = APIRouter(prefix="/api/patients", tags=["patients"])


class PatientCreate(BaseModel):
    firstName: str
    lastName: str
    dateOfBirth: str
    gender: str
    phone: str
    nationality: Optional[str] = None
    nationalId: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    bloodType: Optional[str] = None
    allergies: Optional[List[str]] = []
    chronicConditions: Optional[List[str]] = []
    emergencyContactName: Optional[str] = None
    emergencyContactPhone: Optional[str] = None
    insuranceProvider: Optional[str] = None
    insurancePolicyNo: Optional[str] = None
    insuranceCoverageType: Optional[str] = None
    insuranceExpiry: Optional[str] = None
    notes: Optional[str] = None


class PatientUpdate(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    bloodType: Optional[str] = None
    allergies: Optional[List[str]] = None
    chronicConditions: Optional[List[str]] = None
    emergencyContactName: Optional[str] = None
    emergencyContactPhone: Optional[str] = None
    insuranceProvider: Optional[str] = None
    insurancePolicyNo: Optional[str] = None
    insuranceCoverageType: Optional[str] = None
    insuranceExpiry: Optional[str] = None
    notes: Optional[str] = None
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


@router.get("")
def get_patients(
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    search: str = Query(""),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = db.query(models.Patient)

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
    if not all([body.firstName, body.lastName, body.dateOfBirth, body.gender, body.phone]):
        raise HTTPException(status_code=400, detail="First name, last name, date of birth, gender, and phone are required")

    if body.nationalId:
        existing = db.query(models.Patient).filter(models.Patient.nationalId == body.nationalId).first()
        if existing:
            raise HTTPException(status_code=409, detail="A patient with this national ID already exists")

    patient = models.Patient(
        id=generate_id(),
        mrn=generate_mrn(),
        firstName=body.firstName,
        lastName=body.lastName,
        dateOfBirth=datetime.fromisoformat(body.dateOfBirth),
        gender=body.gender,
        nationality=body.nationality,
        nationalId=body.nationalId,
        phone=body.phone,
        email=body.email,
        address=body.address,
        bloodType=body.bloodType or None,
        allergies=body.allergies or [],
        chronicConditions=body.chronicConditions or [],
        emergencyContactName=body.emergencyContactName,
        emergencyContactPhone=body.emergencyContactPhone,
        insuranceProvider=body.insuranceProvider,
        insurancePolicyNo=body.insurancePolicyNo,
        insuranceCoverageType=body.insuranceCoverageType,
        insuranceExpiry=datetime.fromisoformat(body.insuranceExpiry) if body.insuranceExpiry else None,
        notes=body.notes,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
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

    for field, value in body.model_dump(exclude_none=True).items():
        if field == "insuranceExpiry" and value:
            value = datetime.fromisoformat(value)
        setattr(patient, field, value)

    db.commit()
    db.refresh(patient)
    return patient_to_dict(patient)


@router.delete("/{patient_id}")
def delete_patient(patient_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    patient.isActive = False
    db.commit()
    return {"success": True}
