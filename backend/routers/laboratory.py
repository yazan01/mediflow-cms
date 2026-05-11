from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import or_

from database import get_db
from auth import get_current_user, require_roles, generate_id, log_audit
import models

router = APIRouter(prefix="/api/laboratory", tags=["laboratory"])

LAB_ROLES = ("SUPER_ADMIN", "CLINIC_MANAGER", "DOCTOR", "NURSE", "LAB_TECHNICIAN")


def order_to_dict(o: models.LabOrder) -> dict:
    return {
        "id": o.id,
        "patientId": o.patientId,
        "patientName": f"{o.patient.firstName} {o.patient.lastName}" if o.patient else "",
        "mrn": o.patient.mrn if o.patient else "",
        "tests": o.tests or [],
        "priority": o.priority,
        "status": o.status,
        "specimenType": o.specimenType,
        "specimenCollected": o.specimenCollected,
        "collectedAt": o.collectedAt.isoformat() if o.collectedAt else None,
        "notes": o.notes,
        "orderedBy": o.orderedByDoctor.user.name if o.orderedByDoctor and o.orderedByDoctor.user else "",
        "date": o.createdAt.isoformat() if o.createdAt else None,
        "results": [
            {
                "id": r.id,
                "testName": r.testName,
                "value": r.value,
                "unit": r.unit,
                "referenceRange": r.referenceRange,
                "isAbnormal": r.isAbnormal,
                "isCritical": r.isCritical,
                "recordedAt": r.recordedAt.isoformat() if r.recordedAt else None,
            }
            for r in (o.results or [])
        ],
        "branchId": o.consultation.appointment.branchId if o.consultation and o.consultation.appointment else None,
        "createdAt": o.createdAt.isoformat() if o.createdAt else None,
    }


@router.get("")
def get_lab_orders(
    page: int = Query(1, ge=1),
    pageSize: int = Query(15, ge=1, le=100),
    search: str = Query(""),
    status: Optional[str] = None,
    priority: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*LAB_ROLES)),
):
    query = (
        db.query(models.LabOrder)
        .options(
            joinedload(models.LabOrder.patient),
            joinedload(models.LabOrder.orderedByDoctor).joinedload(models.Doctor.user),
            selectinload(models.LabOrder.results),
        )
        .join(models.Patient, isouter=True)
    )

    if search:
        query = query.filter(
            or_(
                models.Patient.firstName.contains(search),
                models.Patient.lastName.contains(search),
                models.Patient.mrn.contains(search),
            )
        )

    if status and status != "ALL":
        query = query.filter(models.LabOrder.status == status)

    if priority and priority != "ALL":
        query = query.filter(models.LabOrder.priority == priority)

    total = query.count()
    data = query.order_by(models.LabOrder.createdAt.desc()).offset((page - 1) * pageSize).limit(pageSize).all()

    return {
        "data": [order_to_dict(o) for o in data],
        "total": total,
        "page": page,
        "pageSize": pageSize,
        "totalPages": -(-total // pageSize),
    }


VALID_LAB_STATUSES = {"PENDING_COLLECTION", "IN_PROGRESS", "RESULTS_READY", "RESULTS_RELEASED", "CANCELLED"}


class LabResultInput(BaseModel):
    testName: str = Field(..., min_length=1, max_length=200)
    value: str = Field(..., min_length=1, max_length=200)
    unit: Optional[str] = Field(None, max_length=50)
    referenceRange: Optional[str] = Field(None, max_length=100)
    isAbnormal: bool = False
    isCritical: bool = False


class LabOrderUpdate(BaseModel):
    status: Optional[str] = None
    specimenCollected: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=2000)
    results: Optional[List[LabResultInput]] = None


@router.get("/{order_id}")
def get_lab_order(order_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    order = (
        db.query(models.LabOrder)
        .options(
            joinedload(models.LabOrder.patient),
            joinedload(models.LabOrder.orderedByDoctor).joinedload(models.Doctor.user),
            selectinload(models.LabOrder.results),
            joinedload(models.LabOrder.consultation).joinedload(models.Consultation.appointment),
        )
        .filter(models.LabOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Lab order not found")
    return order_to_dict(order)


@router.patch("/{order_id}")
def update_lab_order(
    order_id: str,
    body: LabOrderUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*LAB_ROLES)),
):
    order = (
        db.query(models.LabOrder)
        .options(
            selectinload(models.LabOrder.results),
            joinedload(models.LabOrder.patient),
            joinedload(models.LabOrder.orderedByDoctor),
        )
        .filter(models.LabOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Lab order not found")

    if body.status is not None:
        if body.status not in VALID_LAB_STATUSES:
            raise HTTPException(status_code=422, detail=f"Invalid status: {body.status!r}")
        order.status = body.status

    if body.specimenCollected is not None:
        order.specimenCollected = body.specimenCollected
        if body.specimenCollected and not order.collectedAt:
            order.collectedAt = datetime.utcnow()
            order.collectedById = current_user.id

    if body.notes is not None:
        order.notes = body.notes

    if body.results is not None:
        # Replace all existing results with new ones
        for r in list(order.results):
            db.delete(r)
        db.flush()
        for r in body.results:
            db.add(models.LabResult(
                id=generate_id(),
                labOrderId=order.id,
                testName=r.testName,
                value=r.value,
                unit=r.unit,
                referenceRange=r.referenceRange,
                isAbnormal=r.isAbnormal,
                isCritical=r.isCritical,
                enteredById=current_user.id,
            ))
        # Auto-advance status when results are entered
        if order.status == "IN_PROGRESS":
            order.status = "RESULTS_READY"

    db.commit()
    db.refresh(order)

    # Notify the ordering doctor when results are ready
    if order.status == "RESULTS_READY" and order.orderedByDoctor:
        patient_name = (
            f"{order.patient.firstName} {order.patient.lastName}" if order.patient else "a patient"
        )
        tests_summary = ", ".join((order.tests or [])[:3])
        db.add(models.Notification(
            id=generate_id(),
            userId=order.orderedByDoctor.userId,
            title="Lab Results Ready",
            message=f"Results for {patient_name} ({tests_summary}) are now available.",
            type="INFO",
            link="/laboratory",
        ))
        db.commit()

    log_audit(db, current_user.id, "UPDATE", "LABORATORY", entity_id=order_id, entity_type="LabOrder")
    return order_to_dict(order)
