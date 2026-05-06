from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from auth import verify_password, create_access_token, log_audit, generate_id
import models

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(body: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    if not body.email or not body.password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    user = db.query(models.User).filter(models.User.email == body.email.lower()).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.isActive:
        raise HTTPException(status_code=403, detail="Account is deactivated. Please contact your administrator.")

    if user.lockedUntil and user.lockedUntil > datetime.now():
        minutes_left = max(1, int((user.lockedUntil - datetime.now()).total_seconds() / 60))
        raise HTTPException(status_code=429, detail=f"Account is locked. Try again in {minutes_left} minute(s).")

    if not verify_password(body.password, user.passwordHash):
        failed = user.failedLogins + 1
        user.failedLogins = failed
        if failed >= 5:
            from datetime import timedelta
            user.lockedUntil = datetime.now() + timedelta(minutes=15)
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

    token = create_access_token({
        "sub": user.id,
        "name": user.name,
        "email": user.email,
        "roles": user.roles,
    })

    response.set_cookie(
        key="mediflow_token",
        value=token,
        httponly=True,
        max_age=8 * 3600,
        samesite="lax",
        path="/",
    )

    return {
        "success": True,
        "user": {"id": user.id, "name": user.name, "email": user.email, "roles": user.roles},
    }


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("mediflow_token", path="/")
    return {"success": True}
