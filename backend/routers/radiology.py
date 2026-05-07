from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
from auth import get_current_user, require_roles, log_audit

RADIOLOGY_ROLES = ("SUPER_ADMIN", "CLINIC_MANAGER", "DOCTOR", "NURSE", "RADIOLOGIST")
import models

router = APIRouter(prefix="/api/radiology", tags=["radiology"])


def order_to_dict(o: models.RadiologyOrder) -> dict:
    return {
        "id": o.id,
        "patientId": o.patientId,
        "patientName": f"{o.patient.firstName} {o.patient.lastName}" if o.patient else "",
        "mrn": o.patient.mrn if o.patient else "",
        "modality": o.modality,
        "study": o.study,
        "bodyPart": o.bodyPart,
        "priority": o.priority,
        "status": o.status,
        "clinicalInfo": o.clinicalInfo,
        "scheduledAt": o.scheduledAt.isoformat() if o.scheduledAt else None,
        "performedAt": o.performedAt.isoformat() if o.performedAt else None,
        "report": o.report,
        "imageUrls": o.imageUrls or [],
        "notes": o.notes,
        "orderedBy": o.orderedByDoctor.user.name if o.orderedByDoctor and o.orderedByDoctor.user else "",
        "date": o.createdAt.isoformat() if o.createdAt else None,
        "createdAt": o.createdAt.isoformat() if o.createdAt else None,
    }


@router.get("")
def get_radiology_orders(
    page: int = Query(1, ge=1),
    pageSize: int = Query(15, ge=1, le=100),
    search: str = Query(""),
    status: Optional[str] = None,
    modality: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*RADIOLOGY_ROLES)),
):
    query = db.query(models.RadiologyOrder).join(models.Patient, isouter=True)

    if search:
        query = query.filter(
            or_(
                models.Patient.firstName.contains(search),
                models.Patient.lastName.contains(search),
                models.Patient.mrn.contains(search),
                models.RadiologyOrder.study.contains(search),
            )
        )

    if status and status != "ALL":
        query = query.filter(models.RadiologyOrder.status == status)

    if modality and modality != "ALL":
        query = query.filter(models.RadiologyOrder.modality == modality)

    total = query.count()
    data = query.order_by(models.RadiologyOrder.createdAt.desc()).offset((page - 1) * pageSize).limit(pageSize).all()

    return {
        "data": [order_to_dict(o) for o in data],
        "total": total,
        "page": page,
        "pageSize": pageSize,
        "totalPages": -(-total // pageSize),
    }


VALID_RADIOLOGY_STATUSES = {"PENDING", "SCHEDULED", "IN_PROGRESS", "IMAGES_ACQUIRED", "REPORT_READY", "CANCELLED"}


class RadiologyOrderUpdate(BaseModel):
    status: Optional[str] = None
    scheduledAt: Optional[str] = Field(None, max_length=40)
    report: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=2000)


@router.patch("/{order_id}")
def update_radiology_order(
    order_id: str,
    body: RadiologyOrderUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*RADIOLOGY_ROLES)),
):
    order = db.query(models.RadiologyOrder).filter(models.RadiologyOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Radiology order not found")

    if body.status is not None:
        if body.status not in VALID_RADIOLOGY_STATUSES:
            raise HTTPException(status_code=422, detail=f"Invalid status: {body.status!r}")
        order.status = body.status
        if body.status == "IN_PROGRESS" and not order.performedAt:
            order.performedAt = datetime.utcnow()

    if body.scheduledAt is not None:
        try:
            order.scheduledAt = datetime.fromisoformat(body.scheduledAt)
        except (ValueError, TypeError):
            raise HTTPException(status_code=422, detail=f"Invalid scheduledAt: {body.scheduledAt!r}")

    if body.report is not None:
        order.report = body.report
        order.reportedById = current_user.id
        if order.status not in ("REPORT_READY", "CANCELLED"):
            order.status = "REPORT_READY"

    if body.notes is not None:
        order.notes = body.notes

    db.commit()
    db.refresh(order)
    log_audit(db, current_user.id, "UPDATE", "RADIOLOGY", entity_id=order_id, entity_type="RadiologyOrder")
    return order_to_dict(order)
