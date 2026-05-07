import hashlib
import os
import re
import secrets
import uuid
import json
from datetime import datetime, timezone, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required and not set")
JWT_ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)


def generate_id() -> str:
    return uuid.uuid4().hex[:25]


def generate_mrn(db=None) -> str:
    """Generate a unique MRN. Pass db session to guarantee uniqueness via retry."""
    year = datetime.now().year
    for _ in range(10):
        rand = secrets.randbelow(900000) + 100000
        candidate = f"MRN-{year}-{rand}"
        if db is None:
            return candidate
        if not db.query(models.Patient).filter(models.Patient.mrn == candidate).first():
            return candidate
    raise RuntimeError("Failed to generate unique MRN after 10 attempts")


def generate_emp_code() -> str:
    rand = secrets.randbelow(9000) + 1000
    return f"EMP-{rand}"


def generate_invoice_no(db=None) -> str:
    now = datetime.now()
    month = str(now.month).zfill(2)
    for _ in range(10):
        rand = secrets.randbelow(90000) + 10000
        candidate = f"INV-{now.year}{month}-{rand}"
        if db is None:
            return candidate
        if not db.query(models.Invoice).filter(models.Invoice.invoiceNo == candidate).first():
            return candidate
    raise RuntimeError("Failed to generate unique invoice number after 10 attempts")


def generate_po_number() -> str:
    rand = secrets.randbelow(90000) + 10000
    return f"PO-{datetime.now().year}-{rand}"


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    to_encode["exp"] = datetime.now(timezone.utc) + timedelta(hours=8)
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


_HTML_TAG_RE = re.compile(r"<[^>]+>")


def sanitize_string(value: Optional[str]) -> Optional[str]:
    """Strip HTML tags to prevent stored XSS."""
    if value is None:
        return None
    return _HTML_TAG_RE.sub("", value).strip()


def require_roles(*allowed_roles: str):
    """FastAPI dependency that enforces role-based access control."""
    def checker(current_user: models.User = Depends(get_current_user)) -> models.User:
        user_roles = current_user.roles if isinstance(current_user.roles, list) else []
        if not any(r in allowed_roles for r in user_roles):
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required role: {' or '.join(allowed_roles)}",
            )
        return current_user
    return checker


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def revoke_token(db: Session, token: str, exp: datetime) -> None:
    """Insert token into blocklist. Called on logout."""
    th = _token_hash(token)
    if not db.query(models.TokenBlocklist).filter(models.TokenBlocklist.tokenHash == th).first():
        db.add(models.TokenBlocklist(id=generate_id(), tokenHash=th, expiresAt=exp))
        db.commit()
    # Prune expired entries to keep the table lean
    db.query(models.TokenBlocklist).filter(
        models.TokenBlocklist.expiresAt < datetime.utcnow()
    ).delete()
    db.commit()


def get_current_user(
    mediflow_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db),
) -> models.User:
    if not mediflow_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(mediflow_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Check token blocklist (logout revocation)
    th = _token_hash(mediflow_token)
    if db.query(models.TokenBlocklist).filter(models.TokenBlocklist.tokenHash == th).first():
        raise HTTPException(status_code=401, detail="Token has been revoked")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def log_audit(
    db: Session,
    user_id: str,
    action: str,
    module: str,
    entity_id: str = None,
    entity_type: str = None,
    old_values: dict = None,
    new_values: dict = None,
    ip_address: str = None,
):
    try:
        log = models.AuditLog(
            id=generate_id(),
            userId=user_id,
            action=action,
            module=module,
            entityId=entity_id,
            entityType=entity_type,
            oldValues=json.dumps(old_values) if old_values else None,
            newValues=json.dumps(new_values) if new_values else None,
            ipAddress=ip_address,
        )
        db.add(log)
        db.commit()
    except Exception:
        db.rollback()
