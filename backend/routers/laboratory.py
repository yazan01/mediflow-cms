from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/laboratory", tags=["laboratory"])


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
    _user=Depends(get_current_user),
):
    query = db.query(models.LabOrder).join(models.Patient, isouter=True)

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
