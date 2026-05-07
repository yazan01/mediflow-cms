from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_db
from auth import verify_password, create_access_token, log_audit, generate_id, revoke_token
import models

router = APIRouter(prefix="/api/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


class LoginRequest(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., max_length=128)


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
            from datetime import timedelta
            user.lockedUntil = datetime.utcnow() + timedelta(minutes=15)
            user.failedLogins = 0
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user.failedLogins = 0
    user.lockedUntil = None
    user.lastLogin = datetime.now()
    db.commit()

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    log_audit(db, user.id, "LOGIN", "AUTH", ip_address=ip)

    if user.twoFAEnabled:
        return {"requires2FA": True, "userId": user.id}

    import json as _json
    roles = user.roles
    if isinstance(roles, str):
        try:
            roles = _json.loads(roles)
        except Exception:
            roles = []

    token = create_access_token({
        "sub": user.id,
        "name": user.name,
        "email": user.email,
        "roles": roles,
    })

    response.set_cookie(
        key="mediflow_token",
        value=token,
        httponly=True,
        secure=False,  # Set to True when deployed behind HTTPS
        max_age=8 * 3600,
        samesite="strict",
        path="/",
    )

    return {
        "success": True,
        "user": {"id": user.id, "name": user.name, "email": user.email, "roles": roles},
    }


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
                from datetime import datetime
                revoke_token(db, mediflow_token, datetime.utcfromtimestamp(exp_ts))
        except Exception:
            pass  # Revoke best-effort; still clear the cookie
    response.delete_cookie("mediflow_token", path="/")
    return {"success": True}
