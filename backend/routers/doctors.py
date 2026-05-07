from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/doctors", tags=["doctors"])


@router.get("")
def get_doctors(
    search: str = Query(""),
    specialization: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = (
        db.query(models.Doctor)
        .options(
            joinedload(models.Doctor.user),
            joinedload(models.Doctor.department),
        )
        .join(models.User, models.Doctor.userId == models.User.id)
        .filter(models.Doctor.isAvailable == True, models.User.isActive == True)
    )

    if search:
        query = query.filter(models.User.name.contains(search))

    if specialization and specialization != "ALL":
        query = query.filter(models.Doctor.specialization == specialization)

    doctors = query.all()

    return [
        {
            "id": d.id,
            "userId": d.userId,
            "name": d.user.name if d.user else "",
            "specialization": d.specialization,
            "consultationFee": float(d.consultationFee or 0),
            "isAvailable": d.isAvailable,
            "department": {"name": d.department.name} if d.department else None,
        }
        for d in doctors
    ]
