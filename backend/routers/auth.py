import os
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_db
from auth import (
    verify_password, create_access_token, log_audit, generate_id,
    revoke_token, get_current_user, encrypt_secret, decrypt_secret,
)
import models

router = APIRouter(prefix="/api/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

# True in production (HTTPS), False in local dev (HTTP)
_COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

PRIVILEGED_ROLES = {"SUPER_ADMIN", "CLINIC_MANAGER"}


class LoginRequest(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., max_length=128)


class TwoFAVerifyRequest(BaseModel):
    userId: str = Field(..., max_length=36)
    code: str = Field(..., min_length=6, max_length=6)


class TwoFAEnableRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


def _set_csrf_cookie(response: Response) -> str:
    token = secrets.token_hex(32)
    response.set_cookie(
        key="mediflow_csrf",
        value=token,
        httponly=False,
        secure=_COOKIE_SECURE,
        max_age=8 * 3600,
        samesite="strict",
        path="/",
    )
    return token


def _issue_session(user: models.User, roles: list, branch_id, response: Response, db: Session, ip: str) -> dict:
    token = create_access_token({
        "sub": user.id,
        "name": user.name,
        "email": user.email,
        "roles": roles,
        "branchId": branch_id,
    })
    response.set_cookie(
        key="mediflow_token",
        value=token,
        httponly=True,
        secure=_COOKIE_SECURE,
        max_age=8 * 3600,
        samesite="strict",
        path="/",
    )
    _set_csrf_cookie(response)
    log_audit(db, user.id, "LOGIN", "AUTH", ip_address=ip)
    return {"success": True, "user": {"id": user.id, "name": user.name, "email": user.email, "roles": roles}}


@router.post("/login")
@limiter.limit("10/minute")
def login(body: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    if not body.email or not body.password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    user = db.query(models.User).filter(models.User.email == body.email.lower()).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.isActive:
        raise HTTPException(status_code=403, detail="Account is deactivated. Please contact your administrator.")

    _now = datetime.utcnow()
    locked_until = user.lockedUntil.replace(tzinfo=None) if user.lockedUntil and user.lockedUntil.tzinfo else user.lockedUntil
    if locked_until and locked_until > _now:
        minutes_left = max(1, int((locked_until - _now).total_seconds() / 60))
        raise HTTPException(status_code=429, detail=f"Account is locked. Try again in {minutes_left} minute(s).")

    if not verify_password(body.password, user.passwordHash):
        failed = user.failedLogins + 1
        user.failedLogins = failed
        if failed >= 5:
            user.lockedUntil = datetime.utcnow() + timedelta(minutes=15)
            user.failedLogins = 0
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user.failedLogins = 0
    user.lockedUntil = None
    user.lastLogin = datetime.now()
    db.commit()

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")

    import json as _json
    roles = user.roles
    if isinstance(roles, str):
        try:
            roles = _json.loads(roles)
        except Exception:
            roles = []

    # Resolve branchId from the user's employee record (None for SUPER_ADMIN)
    employee = (
        db.query(models.Employee)
        .filter(models.Employee.userId == user.id, models.Employee.deletedAt.is_(None))
        .first()
    )
    branch_id = employee.branchId if employee else None

    # Enforce 2FA for privileged roles
    is_privileged = any(r in PRIVILEGED_ROLES for r in roles)
    if user.twoFAEnabled:
        return {"requires2FA": True, "userId": user.id}

    if is_privileged and not user.twoFAEnabled:
        # Issue session but flag that 2FA setup is required
        result = _issue_session(user, roles, branch_id, response, db, ip)
        result["requires2FASetup"] = True
        return result

    return _issue_session(user, roles, branch_id, response, db, ip)


@router.post("/logout")
def logout(
    response: Response,
    mediflow_token: str = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if mediflow_token:
        try:
            from jose import jwt as _jwt
            from auth import JWT_SECRET, JWT_ALGORITHM
            payload = _jwt.decode(mediflow_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            exp_ts = payload.get("exp")
            if exp_ts:
                revoke_token(db, mediflow_token, datetime.utcfromtimestamp(exp_ts))
        except Exception:
            pass
    response.delete_cookie("mediflow_token", path="/")
    response.delete_cookie("mediflow_csrf", path="/")
    return {"success": True}


# ─── CSRF token refresh ───────────────────────────────────────────────────────

@router.get("/csrf")
def get_csrf_token(response: Response, _user=Depends(get_current_user)):
    token = _set_csrf_cookie(response)
    return {"csrfToken": token}


# ─── 2FA — TOTP setup, enable, verify, disable ───────────────────────────────

@router.post("/2fa/setup")
def setup_2fa(user: models.User = Depends(get_current_user)):
    try:
        import pyotp
    except ImportError:
        raise HTTPException(500, "pyotp not installed. Run: pip install pyotp")

    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    issuer = "MediFlow CMS"
    otp_uri = totp.provisioning_uri(name=user.email, issuer_name=issuer)
    return {
        "secret": secret,
        "otpUri": otp_uri,
        "issuer": issuer,
    }


@router.post("/2fa/enable")
def enable_2fa(
    body: TwoFAEnableRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    try:
        import pyotp
    except ImportError:
        raise HTTPException(500, "pyotp not installed. Run: pip install pyotp")

    # The client must send the secret from /2fa/setup (stored temporarily client-side)
    # and a live TOTP code to prove they have the authenticator configured correctly.
    # We re-derive the secret from the submitted code by accepting a body with {code, secret}.
    raise HTTPException(400, "Call POST /2fa/enable with {secret, code} — use the TwoFAEnableWithSecretRequest schema")


class TwoFAEnableWithSecretRequest(BaseModel):
    secret: str = Field(..., min_length=16, max_length=64)
    code: str = Field(..., min_length=6, max_length=6)


@router.post("/2fa/enable-confirm")
def enable_2fa_confirm(
    body: TwoFAEnableWithSecretRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    try:
        import pyotp
    except ImportError:
        raise HTTPException(500, "pyotp not installed. Run: pip install pyotp")

    totp = pyotp.TOTP(body.secret)
    if not totp.verify(body.code, valid_window=1):
        raise HTTPException(400, "Invalid TOTP code. Check your authenticator app and try again.")

    db_user = db.query(models.User).filter(models.User.id == user.id).with_for_update().first()
    db_user.twoFASecret = encrypt_secret(body.secret)
    db_user.twoFAEnabled = True
    db.commit()
    log_audit(db, user.id, "ENABLE_2FA", "AUTH")
    return {"success": True, "message": "Two-factor authentication enabled."}


@router.post("/2fa/verify")
@limiter.limit("10/minute")
def verify_2fa(body: TwoFAVerifyRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    try:
        import pyotp
    except ImportError:
        raise HTTPException(500, "pyotp not installed. Run: pip install pyotp")

    user = db.query(models.User).filter(models.User.id == body.userId).first()
    if not user or not user.twoFAEnabled or not user.twoFASecret:
        raise HTTPException(400, "2FA not configured for this account")

    if not user.isActive:
        raise HTTPException(403, "Account is deactivated. Please contact your administrator.")

    secret = decrypt_secret(user.twoFASecret)
    totp = pyotp.TOTP(secret)
    if not totp.verify(body.code, valid_window=1):
        raise HTTPException(401, "Invalid or expired TOTP code")

    import json as _json
    roles = user.roles
    if isinstance(roles, str):
        try:
            roles = _json.loads(roles)
        except Exception:
            roles = []

    employee = (
        db.query(models.Employee)
        .filter(models.Employee.userId == user.id, models.Employee.deletedAt.is_(None))
        .first()
    )
    branch_id = employee.branchId if employee else None

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    return _issue_session(user, roles, branch_id, response, db, ip=ip)


@router.post("/2fa/disable")
def disable_2fa(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    import json as _json
    roles = user.roles if isinstance(user.roles, list) else []
    if any(r in PRIVILEGED_ROLES for r in roles):
        raise HTTPException(403, "Privileged accounts (SUPER_ADMIN, CLINIC_MANAGER) cannot disable 2FA once enabled.")

    db_user = db.query(models.User).filter(models.User.id == user.id).with_for_update().first()
    db_user.twoFAEnabled = False
    db_user.twoFASecret = None
    db.commit()
    log_audit(db, user.id, "DISABLE_2FA", "AUTH")
    return {"success": True}
