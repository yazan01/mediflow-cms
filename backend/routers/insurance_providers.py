from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional

from database import get_db
from auth import get_current_user, generate_id, log_audit
from models import InsuranceProvider

router = APIRouter(prefix="/api/insurance-providers", tags=["insurance-providers"])

MANAGE_ROLES = ("SUPER_ADMIN", "CLINIC_MANAGER")


def _row(p: InsuranceProvider) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "code": p.code,
        "contactPhone": p.contactPhone,
        "contactEmail": p.contactEmail,
        "notes": p.notes,
        "isActive": p.isActive,
        "createdAt": p.createdAt.isoformat() if p.createdAt else None,
    }


class ProviderIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    code: Optional[str] = Field(None, max_length=50)
    contactPhone: Optional[str] = Field(None, max_length=50)
    contactEmail: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = Field(None, max_length=1000)
    isActive: bool = True


@router.get("")
def list_providers(
    active_only: bool = False,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(InsuranceProvider)
    if active_only:
        q = q.filter(InsuranceProvider.isActive == True)
    return [_row(p) for p in q.order_by(InsuranceProvider.name).all()]


@router.post("", status_code=201)
def create_provider(
    body: ProviderIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not any(r in (current_user.roles or []) for r in MANAGE_ROLES):
        raise HTTPException(403, "Insufficient permissions")

    code = body.code.strip().upper() if body.code else None
    if code:
        exists = db.query(InsuranceProvider).filter(InsuranceProvider.code == code).first()
        if exists:
            raise HTTPException(400, "A provider with this code already exists")

    p = InsuranceProvider(
        id=generate_id(),
        name=body.name.strip(),
        code=code,
        contactPhone=body.contactPhone,
        contactEmail=body.contactEmail,
        notes=body.notes,
        isActive=body.isActive,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    log_audit(db, current_user.id, "CREATE", "InsuranceProvider", p.id, {"name": p.name})
    return _row(p)


@router.patch("/{provider_id}")
def update_provider(
    provider_id: str,
    body: ProviderIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not any(r in (current_user.roles or []) for r in MANAGE_ROLES):
        raise HTTPException(403, "Insufficient permissions")

    p = db.query(InsuranceProvider).filter(InsuranceProvider.id == provider_id).first()
    if not p:
        raise HTTPException(404, "Provider not found")

    code = body.code.strip().upper() if body.code else None
    if code and code != p.code:
        exists = db.query(InsuranceProvider).filter(
            InsuranceProvider.code == code,
            InsuranceProvider.id != provider_id,
        ).first()
        if exists:
            raise HTTPException(400, "A provider with this code already exists")

    p.name = body.name.strip()
    p.code = code
    p.contactPhone = body.contactPhone
    p.contactEmail = body.contactEmail
    p.notes = body.notes
    p.isActive = body.isActive
    db.commit()
    db.refresh(p)
    log_audit(db, current_user.id, "UPDATE", "InsuranceProvider", p.id, {"name": p.name})
    return _row(p)


@router.delete("/{provider_id}", status_code=204)
def delete_provider(
    provider_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not any(r in (current_user.roles or []) for r in MANAGE_ROLES):
        raise HTTPException(403, "Insufficient permissions")

    p = db.query(InsuranceProvider).filter(InsuranceProvider.id == provider_id).first()
    if not p:
        raise HTTPException(404, "Provider not found")

    db.delete(p)
    db.commit()
    log_audit(db, current_user.id, "DELETE", "InsuranceProvider", provider_id, {"name": p.name})
