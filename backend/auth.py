import os
import re
import random
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

JWT_SECRET = os.getenv("JWT_SECRET", "mediflow-jwt-secret-change-in-production")
JWT_ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)


def generate_id() -> str:
    return uuid.uuid4().hex[:25]


def generate_mrn() -> str:
    year = datetime.now().year
    rand = random.randint(100000, 999999)
    return f"MRN-{year}-{rand}"


def generate_emp_code() -> str:
    rand = random.randint(1000, 9999)
    return f"EMP-{rand}"


def generate_invoice_no() -> str:
    now = datetime.now()
    month = str(now.month).zfill(2)
    rand = random.randint(10000, 99999)
    return f"INV-{now.year}{month}-{rand}"


def generate_po_number() -> str:
    rand = random.randint(10000, 99999)
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
