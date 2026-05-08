import smtplib
import ssl
from email.mime.text import MIMEText
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_user, require_roles, generate_id, log_audit, encrypt_secret, decrypt_secret, mask_secret
import models

router = APIRouter(prefix="/api/settings/smtp", tags=["smtp"])
SMTP_ADMIN_ROLES = ("SUPER_ADMIN", "CLINIC_MANAGER")


class SmtpUpdate(BaseModel):
    host: Optional[str] = Field(None, max_length=255)
    port: Optional[int] = Field(None, ge=1, le=65535)
    useTLS: Optional[bool] = None
    username: Optional[str] = Field(None, max_length=255)
    password: Optional[str] = None
    fromName: Optional[str] = Field(None, max_length=100)
    fromEmail: Optional[str] = Field(None, max_length=255)
    isActive: Optional[bool] = None


class SmtpTestRequest(BaseModel):
    toEmail: str = Field(..., max_length=255)


def _get_or_create_smtp(db: Session) -> models.SmtpConfig:
    config = db.query(models.SmtpConfig).filter(models.SmtpConfig.branchId == None).first()
    if not config:
        config = models.SmtpConfig(id=generate_id())
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def smtp_to_dict(c: models.SmtpConfig) -> dict:
    return {
        "host": c.host or "",
        "port": c.port or 587,
        "useTLS": bool(c.useTLS),
        "username": c.username or "",
        "passwordMasked": mask_secret(decrypt_secret(c.passwordEncrypted or "")),
        "fromName": c.fromName or "",
        "fromEmail": c.fromEmail or "",
        "isActive": bool(c.isActive),
        "lastTestedAt": c.lastTestedAt.isoformat() if c.lastTestedAt else None,
        "lastTestResult": c.lastTestResult or "",
    }


@router.get("")
def get_smtp(db: Session = Depends(get_db), _user=Depends(require_roles(*SMTP_ADMIN_ROLES))):
    return smtp_to_dict(_get_or_create_smtp(db))


@router.patch("")
def update_smtp(
    body: SmtpUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*SMTP_ADMIN_ROLES)),
):
    config = _get_or_create_smtp(db)
    updates = body.model_dump(exclude_none=True)

    if "password" in updates:
        config.passwordEncrypted = encrypt_secret(updates.pop("password"))
    for field, val in updates.items():
        setattr(config, field, val)

    db.commit()
    db.refresh(config)
    log_audit(db, user.id, "UPDATE", "SmtpConfig", config.id, {"host": config.host})
    return smtp_to_dict(config)


@router.post("/test")
def test_smtp(
    body: SmtpTestRequest,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*SMTP_ADMIN_ROLES)),
):
    from datetime import datetime

    config = _get_or_create_smtp(db)
    if not config.host or not config.fromEmail:
        raise HTTPException(400, "SMTP is not fully configured")

    password = decrypt_secret(config.passwordEncrypted or "")
    result = "failed"
    error_msg = ""

    try:
        msg = MIMEText(
            "This is a test email from MediFlow CMS to verify your SMTP configuration.",
            "plain",
            "utf-8",
        )
        msg["Subject"] = "MediFlow CMS — SMTP Test"
        msg["From"] = f"{config.fromName or 'MediFlow'} <{config.fromEmail}>"
        msg["To"] = body.toEmail

        ctx = ssl.create_default_context()
        if config.useTLS:
            with smtplib.SMTP(config.host, config.port or 587) as server:
                server.ehlo()
                server.starttls(context=ctx)
                if config.username:
                    server.login(config.username, password)
                server.sendmail(config.fromEmail, [body.toEmail], msg.as_string())
        else:
            with smtplib.SMTP(config.host, config.port or 25) as server:
                if config.username:
                    server.login(config.username, password)
                server.sendmail(config.fromEmail, [body.toEmail], msg.as_string())

        result = "success"
    except Exception as e:
        error_msg = str(e)[:200]
        result = "failed"

    config.lastTestedAt = datetime.now()
    config.lastTestResult = result
    db.commit()

    if result == "failed":
        raise HTTPException(502, f"SMTP test failed: {error_msg}")

    return {"result": "success", "message": f"Test email sent to {body.toEmail}"}
