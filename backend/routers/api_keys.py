import hashlib
import secrets
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.orm import Session

from database import get_db
from auth import require_roles, generate_id, log_audit
import models

router = APIRouter(prefix="/api/settings/api-keys", tags=["api-keys"])
KEY_ADMIN_ROLES = ("SUPER_ADMIN", "CLINIC_MANAGER")

VALID_SCOPES = {
    "read:patients", "write:patients",
    "read:appointments", "write:appointments",
    "read:reports", "read:billing",
    "write:billing", "read:hr",
    "admin:full",
}


class ApiKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    branchId: Optional[str] = None
    scopes: List[str] = Field(default_factory=list)
    expiresAt: Optional[str] = None


def key_to_dict(k: models.ApiKey, plaintext: Optional[str] = None) -> dict:
    return {
        "id": k.id,
        "name": k.name,
        "keyPrefix": k.keyPrefix or "",
        "branchId": k.branchId,
        "scopes": k.scopes or [],
        "isActive": bool(k.isActive),
        "lastUsedAt": k.lastUsedAt.isoformat() if k.lastUsedAt else None,
        "expiresAt": k.expiresAt.isoformat() if k.expiresAt else None,
        "createdAt": k.createdAt.isoformat() if k.createdAt else None,
        **({"key": plaintext} if plaintext else {}),
    }


@router.get("")
def list_api_keys(
    branch_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*KEY_ADMIN_ROLES)),
):
    q = db.query(models.ApiKey)
    if branch_id:
        q = q.filter(models.ApiKey.branchId == branch_id)
    keys = q.order_by(models.ApiKey.createdAt.desc()).all()
    return [key_to_dict(k) for k in keys]


@router.post("", status_code=201)
def create_api_key(
    body: ApiKeyCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*KEY_ADMIN_ROLES)),
):
    invalid_scopes = [s for s in body.scopes if s not in VALID_SCOPES]
    if invalid_scopes:
        raise HTTPException(422, f"Invalid scopes: {', '.join(invalid_scopes)}")

    if body.branchId:
        if not db.query(models.Branch).filter(models.Branch.id == body.branchId).first():
            raise HTTPException(404, "Branch not found")

    raw_key = "mf_" + secrets.token_hex(32)
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    prefix = raw_key[:10]

    expires = None
    if body.expiresAt:
        try:
            expires = datetime.fromisoformat(body.expiresAt)
        except ValueError:
            raise HTTPException(422, "Invalid expiresAt format — use ISO 8601")

    api_key = models.ApiKey(
        id=generate_id(),
        name=body.name,
        branchId=body.branchId,
        keyHashSha256=key_hash,
        keyPrefix=prefix,
        scopes=body.scopes,
        expiresAt=expires,
        createdBy=user.id,
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)

    log_audit(db, user.id, "CREATE", "ApiKey", api_key.id, {"name": body.name, "scopes": body.scopes})

    return key_to_dict(api_key, plaintext=raw_key)


@router.delete("/{key_id}", status_code=204)
def revoke_api_key(
    key_id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*KEY_ADMIN_ROLES)),
):
    api_key = db.query(models.ApiKey).filter(models.ApiKey.id == key_id).first()
    if not api_key:
        raise HTTPException(404, "API key not found")
    api_key.isActive = False
    db.commit()
    log_audit(db, user.id, "DELETE", "ApiKey", key_id, {"name": api_key.name})


@router.post("/{key_id}/rotate", status_code=200)
def rotate_api_key(
    key_id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*KEY_ADMIN_ROLES)),
):
    """Replace the key material for an active API key. Returns the new plaintext key once."""
    api_key = db.query(models.ApiKey).filter(models.ApiKey.id == key_id).with_for_update().first()
    if not api_key:
        raise HTTPException(404, "API key not found")
    if not api_key.isActive:
        raise HTTPException(400, "Cannot rotate a revoked key — create a new one instead")

    raw_key = "mf_" + secrets.token_hex(32)
    api_key.keyHashSha256 = hashlib.sha256(raw_key.encode()).hexdigest()
    api_key.keyPrefix = raw_key[:10]
    api_key.lastUsedAt = None
    db.commit()
    db.refresh(api_key)

    log_audit(db, user.id, "ROTATE", "ApiKey", key_id, {"name": api_key.name})
    return key_to_dict(api_key, plaintext=raw_key)
