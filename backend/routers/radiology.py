from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
from auth import get_current_user
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
    _user=Depends(get_current_user),
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
