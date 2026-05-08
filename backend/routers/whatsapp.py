import hashlib
import hmac
import json as _json_mod
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_user, require_roles, generate_id, log_audit, encrypt_secret, decrypt_secret, mask_secret
import models

router = APIRouter(prefix="/api/settings/whatsapp", tags=["whatsapp"])
WA_ADMIN_ROLES = ("SUPER_ADMIN", "CLINIC_MANAGER")

VALID_CATEGORIES = {"APPOINTMENT_REMINDER", "FOLLOW_UP", "CONFIRMATION", "CANCELLATION", "QUEUE", "GENERAL"}


class WaConfigUpdate(BaseModel):
    phoneNumberId: Optional[str] = Field(None, max_length=50)
    wabaId: Optional[str] = Field(None, max_length=50)
    accessToken: Optional[str] = None
    appSecret: Optional[str] = None
    webhookVerifyToken: Optional[str] = Field(None, max_length=100)
    phoneNumber: Optional[str] = Field(None, max_length=20)
    displayName: Optional[str] = Field(None, max_length=100)
    isActive: Optional[bool] = None
    autoReplyEnabled: Optional[bool] = None
    businessHoursOnly: Optional[bool] = None
    aiReplyEnabled: Optional[bool] = None


class WaTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: str = "APPOINTMENT_REMINDER"
    language: str = Field("en", max_length=10)
    bodyText: str = Field(..., min_length=1)


class WaTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    category: Optional[str] = None
    language: Optional[str] = Field(None, max_length=10)
    bodyText: Optional[str] = None
    isActive: Optional[bool] = None


class WaTestRequest(BaseModel):
    toNumber: str = Field(..., max_length=20)
    message: str = Field(..., max_length=1000)


def _get_or_create(db: Session, branch_id: str) -> models.WhatsAppConfig:
    cfg = db.query(models.WhatsAppConfig).filter(models.WhatsAppConfig.branchId == branch_id).first()
    if not cfg:
        cfg = models.WhatsAppConfig(id=generate_id(), branchId=branch_id, webhookVerifyToken=generate_id())
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def config_to_dict(cfg: models.WhatsAppConfig) -> dict:
    return {
        "branchId": cfg.branchId,
        "phoneNumberId": cfg.phoneNumberId or "",
        "wabaId": cfg.wabaId or "",
        "accessTokenMasked": mask_secret(decrypt_secret(cfg.accessTokenEncrypted or "")),
        "appSecretMasked": mask_secret(decrypt_secret(cfg.appSecretEncrypted or "")),
        "webhookVerifyToken": cfg.webhookVerifyToken or "",
        "phoneNumber": cfg.phoneNumber or "",
        "displayName": cfg.displayName or "",
        "isVerified": bool(cfg.isVerified),
        "isActive": bool(cfg.isActive),
        "autoReplyEnabled": bool(cfg.autoReplyEnabled),
        "businessHoursOnly": bool(cfg.businessHoursOnly),
        "aiReplyEnabled": bool(cfg.aiReplyEnabled),
        "updatedAt": cfg.updatedAt.isoformat() if cfg.updatedAt else None,
    }


def template_to_dict(t: models.WhatsAppTemplate) -> dict:
    return {
        "id": t.id,
        "configId": t.configId,
        "name": t.name,
        "category": t.category,
        "language": t.language,
        "bodyText": t.bodyText or "",
        "isActive": bool(t.isActive),
        "usageCount": t.usageCount or 0,
        "createdAt": t.createdAt.isoformat() if t.createdAt else None,
    }


# ─── Config endpoints ─────────────────────────────────────────────────────────

@router.get("/{branch_id}")
def get_wa_config(branch_id: str, db: Session = Depends(get_db), _user=Depends(require_roles(*WA_ADMIN_ROLES))):
    _check_branch(branch_id, db)
    return config_to_dict(_get_or_create(db, branch_id))


@router.patch("/{branch_id}")
def update_wa_config(
    branch_id: str,
    body: WaConfigUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*WA_ADMIN_ROLES)),
):
    _check_branch(branch_id, db)
    cfg = _get_or_create(db, branch_id)
    updates = body.model_dump(exclude_none=True)

    if "accessToken" in updates:
        cfg.accessTokenEncrypted = encrypt_secret(updates.pop("accessToken"))
    if "appSecret" in updates:
        cfg.appSecretEncrypted = encrypt_secret(updates.pop("appSecret"))

    for field, val in updates.items():
        setattr(cfg, field, val)

    db.commit()
    db.refresh(cfg)
    log_audit(db, user.id, "UPDATE", "WhatsAppConfig", cfg.id, {"branchId": branch_id})
    return config_to_dict(cfg)


@router.post("/{branch_id}/test")
def test_wa_send(
    branch_id: str,
    body: WaTestRequest,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*WA_ADMIN_ROLES)),
):
    _check_branch(branch_id, db)
    cfg = db.query(models.WhatsAppConfig).filter(models.WhatsAppConfig.branchId == branch_id).first()
    if not cfg or not cfg.phoneNumberId:
        raise HTTPException(400, "WhatsApp is not fully configured for this branch")
    if not cfg.isActive:
        raise HTTPException(400, "WhatsApp integration is disabled for this branch")

    token = decrypt_secret(cfg.accessTokenEncrypted or "")
    if not token:
        raise HTTPException(400, "Access token not configured")

    try:
        import urllib.request, json as _json
        payload = _json.dumps({
            "messaging_product": "whatsapp",
            "to": body.toNumber,
            "type": "text",
            "text": {"body": body.message},
        }).encode()
        req = urllib.request.Request(
            f"https://graph.facebook.com/v19.0/{cfg.phoneNumberId}/messages",
            data=payload,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = _json.loads(resp.read())
        return {"success": True, "messageId": result.get("messages", [{}])[0].get("id", "")}
    except Exception as e:
        raise HTTPException(502, f"WhatsApp API error: {str(e)[:200]}")


# ─── Templates ────────────────────────────────────────────────────────────────

@router.get("/{branch_id}/templates")
def list_templates(branch_id: str, db: Session = Depends(get_db), _user=Depends(require_roles(*WA_ADMIN_ROLES))):
    _check_branch(branch_id, db)
    cfg = db.query(models.WhatsAppConfig).filter(models.WhatsAppConfig.branchId == branch_id).first()
    if not cfg:
        return []
    templates = db.query(models.WhatsAppTemplate).filter(models.WhatsAppTemplate.configId == cfg.id).order_by(models.WhatsAppTemplate.category).all()
    return [template_to_dict(t) for t in templates]


@router.post("/{branch_id}/templates", status_code=201)
def create_template(
    branch_id: str,
    body: WaTemplateCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*WA_ADMIN_ROLES)),
):
    _check_branch(branch_id, db)
    cfg = _get_or_create(db, branch_id)

    if body.category not in VALID_CATEGORIES:
        raise HTTPException(422, f"Invalid category. Valid: {', '.join(sorted(VALID_CATEGORIES))}")

    tmpl = models.WhatsAppTemplate(
        id=generate_id(),
        configId=cfg.id,
        name=body.name,
        category=body.category,
        language=body.language,
        bodyText=body.bodyText,
    )
    db.add(tmpl)
    db.commit()
    db.refresh(tmpl)
    log_audit(db, user.id, "CREATE", "WhatsAppTemplate", tmpl.id, {"name": tmpl.name})
    return template_to_dict(tmpl)


@router.patch("/{branch_id}/templates/{template_id}")
def update_template(
    branch_id: str,
    template_id: str,
    body: WaTemplateUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*WA_ADMIN_ROLES)),
):
    tmpl = db.query(models.WhatsAppTemplate).filter(models.WhatsAppTemplate.id == template_id).first()
    if not tmpl:
        raise HTTPException(404, "Template not found")
    if body.category and body.category not in VALID_CATEGORIES:
        raise HTTPException(422, "Invalid category")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(tmpl, field, val)
    db.commit()
    db.refresh(tmpl)
    return template_to_dict(tmpl)


@router.delete("/{branch_id}/templates/{template_id}", status_code=204)
def delete_template(
    branch_id: str,
    template_id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*WA_ADMIN_ROLES)),
):
    tmpl = db.query(models.WhatsAppTemplate).filter(models.WhatsAppTemplate.id == template_id).first()
    if not tmpl:
        raise HTTPException(404, "Template not found")
    db.delete(tmpl)
    db.commit()
    log_audit(db, user.id, "DELETE", "WhatsAppTemplate", template_id, {})


# ─── Webhook (public — no auth, verified by Meta signature) ──────────────────

webhook_router = APIRouter(prefix="/api/webhooks/whatsapp", tags=["whatsapp-webhook"])


@webhook_router.get("/{branch_id}")
def webhook_verify(
    branch_id: str,
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
    hub_verify_token: str = Query(None, alias="hub.verify.token"),
    db: Session = Depends(get_db),
):
    cfg = db.query(models.WhatsAppConfig).filter(models.WhatsAppConfig.branchId == branch_id).first()
    if not cfg or not cfg.webhookVerifyToken:
        raise HTTPException(404)
    if hub_mode == "subscribe" and hub_verify_token == cfg.webhookVerifyToken:
        return PlainTextResponse(hub_challenge or "")
    raise HTTPException(403, "Invalid verify token")


def _process_webhook_event(event_id: str):
    """Background task: mark event processed; trigger auto-reply if enabled."""
    from database import SessionLocal
    db = SessionLocal()
    try:
        evt = db.query(models.WebhookEvent).filter(models.WebhookEvent.id == event_id).first()
        if not evt or evt.processed:
            return
        cfg = db.query(models.WhatsAppConfig).filter(models.WhatsAppConfig.branchId == evt.branchId).first()
        if cfg and cfg.autoReplyEnabled and cfg.isActive and evt.fromNumber:
            # Simple auto-reply: send a "received your message" acknowledgement
            token = decrypt_secret(cfg.accessTokenEncrypted or "")
            if token and cfg.phoneNumberId:
                try:
                    import urllib.request, json as _j
                    payload = _j.dumps({
                        "messaging_product": "whatsapp",
                        "to": evt.fromNumber,
                        "type": "text",
                        "text": {"body": "Thank you for your message. Our team will get back to you shortly."},
                    }).encode()
                    req = urllib.request.Request(
                        f"https://graph.facebook.com/v19.0/{cfg.phoneNumberId}/messages",
                        data=payload,
                        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                        method="POST",
                    )
                    urllib.request.urlopen(req, timeout=10)
                except Exception:
                    pass
        evt.processed = True
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


@webhook_router.post("/{branch_id}", status_code=200)
async def webhook_receive(branch_id: str, request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    cfg = db.query(models.WhatsAppConfig).filter(models.WhatsAppConfig.branchId == branch_id).first()
    if not cfg:
        raise HTTPException(404)

    body_bytes = await request.body()
    signature = request.headers.get("x-hub-signature-256", "")

    if cfg.appSecretEncrypted:
        app_secret = decrypt_secret(cfg.appSecretEncrypted)
        expected = "sha256=" + hmac.new(app_secret.encode(), body_bytes, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise HTTPException(401, "Invalid webhook signature")

    # Parse payload and log webhook event
    try:
        payload_data = _json_mod.loads(body_bytes)
    except Exception:
        payload_data = {}

    from_number = None
    event_type = "unknown"
    try:
        entry = payload_data.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])
        if messages:
            event_type = messages[0].get("type", "message")
            from_number = messages[0].get("from")
        else:
            statuses = value.get("statuses", [])
            if statuses:
                event_type = "status_" + statuses[0].get("status", "update")
                from_number = statuses[0].get("recipient_id")
    except Exception:
        pass

    from auth import generate_id
    evt = models.WebhookEvent(
        id=generate_id(),
        branchId=branch_id,
        source="whatsapp",
        eventType=event_type,
        fromNumber=from_number,
        payload=payload_data,
        processed=False,
    )
    db.add(evt)
    db.commit()

    background_tasks.add_task(_process_webhook_event, evt.id)
    return {"status": "received"}


# ─── Webhook event log (authenticated) ───────────────────────────────────────

@router.get("/{branch_id}/webhook-events")
def list_webhook_events(
    branch_id: str,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    _user=Depends(require_roles(*WA_ADMIN_ROLES)),
):
    _check_branch(branch_id, db)
    events = (
        db.query(models.WebhookEvent)
        .filter(models.WebhookEvent.branchId == branch_id, models.WebhookEvent.source == "whatsapp")
        .order_by(models.WebhookEvent.createdAt.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": e.id,
            "eventType": e.eventType,
            "fromNumber": e.fromNumber,
            "processed": bool(e.processed),
            "createdAt": e.createdAt.isoformat() if e.createdAt else None,
        }
        for e in events
    ]


# ─── Meta template sync ──────────────────────────────────────────────────────

@router.post("/{branch_id}/sync-templates", status_code=200)
def sync_meta_templates(
    branch_id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*WA_ADMIN_ROLES)),
):
    """Pull approved WhatsApp templates from Meta Graph API and upsert them locally."""
    _check_branch(branch_id, db)
    cfg = db.query(models.WhatsAppConfig).filter(models.WhatsAppConfig.branchId == branch_id).first()
    if not cfg or not cfg.wabaId:
        raise HTTPException(400, "WhatsApp WABA ID not configured")
    token = decrypt_secret(cfg.accessTokenEncrypted or "")
    if not token:
        raise HTTPException(400, "Access token not configured")

    try:
        import urllib.request, json as _j
        url = f"https://graph.facebook.com/v19.0/{cfg.wabaId}/message_templates?limit=100"
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = _j.loads(resp.read())
    except Exception as e:
        raise HTTPException(502, f"Meta API error: {str(e)[:200]}")

    synced = 0
    for tpl_data in data.get("data", []):
        name = tpl_data.get("name", "")[:100]
        category = tpl_data.get("category", "APPOINTMENT_REMINDER")
        language = tpl_data.get("language", "en")[:10]
        status = tpl_data.get("status", "")
        if status != "APPROVED":
            continue
        # Extract body text from components
        body_text = ""
        for comp in tpl_data.get("components", []):
            if comp.get("type") == "BODY":
                body_text = comp.get("text", "")
                break
        if not body_text:
            continue

        existing = db.query(models.WhatsAppTemplate).filter(
            models.WhatsAppTemplate.configId == cfg.id,
            models.WhatsAppTemplate.name == name,
        ).first()
        if existing:
            existing.category = category
            existing.language = language
            existing.bodyText = body_text
        else:
            db.add(models.WhatsAppTemplate(
                id=generate_id(), configId=cfg.id,
                name=name, category=category, language=language, bodyText=body_text,
            ))
        synced += 1

    db.commit()
    log_audit(db, user.id, "SYNC", "WhatsAppTemplate", cfg.id, {"synced": synced, "branchId": branch_id})
    return {"synced": synced}


# ─── Helper ───────────────────────────────────────────────────────────────────

def _check_branch(branch_id: str, db: Session):
    if not db.query(models.Branch).filter(models.Branch.id == branch_id).first():
        raise HTTPException(404, "Branch not found")
