from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.orm import Session

from database import get_db
from auth import require_roles, generate_id, log_audit
import models

router = APIRouter(prefix="/api/settings/notification-templates", tags=["notification-templates"])

VALID_EVENT_TYPES = {
    "appointment_reminder", "appointment_confirmation", "appointment_cancellation",
    "lab_results", "payment_receipt", "password_reset", "welcome",
    "low_stock", "leave_approved", "leave_rejected",
}
VALID_CHANNELS = {"email", "sms", "whatsapp"}
VALID_LANGUAGES = {"en", "ar"}

DEFAULT_TEMPLATES = [
    {
        "eventType": "appointment_reminder",
        "channel": "sms",
        "language": "en",
        "subject": None,
        "body": "Hi {{patient_name}}, this is a reminder for your appointment at {{clinic_name}} on {{date}} at {{time}}. Reply STOP to opt out.",
        "variables": ["patient_name", "clinic_name", "date", "time"],
        "isDefault": True,
    },
    {
        "eventType": "appointment_reminder",
        "channel": "whatsapp",
        "language": "en",
        "subject": None,
        "body": "Hello {{patient_name}}! 👋\n\nThis is a reminder for your upcoming appointment:\n\n📍 *{{clinic_name}}*\n📅 {{date}} at {{time}}\n\nPlease arrive 10 minutes early. Reply *CANCEL* to cancel.",
        "variables": ["patient_name", "clinic_name", "date", "time"],
        "isDefault": True,
    },
    {
        "eventType": "appointment_reminder",
        "channel": "email",
        "language": "en",
        "subject": "Appointment Reminder — {{clinic_name}}",
        "body": "Dear {{patient_name}},\n\nThis is a friendly reminder of your appointment at {{clinic_name}} on {{date}} at {{time}}.\n\nIf you need to reschedule, please contact us at least 24 hours in advance.\n\nBest regards,\n{{clinic_name}} Team",
        "variables": ["patient_name", "clinic_name", "date", "time"],
        "isDefault": True,
    },
    {
        "eventType": "appointment_confirmation",
        "channel": "sms",
        "language": "en",
        "subject": None,
        "body": "Your appointment at {{clinic_name}} on {{date}} at {{time}} has been confirmed. Ref: {{appointment_id}}.",
        "variables": ["patient_name", "clinic_name", "date", "time", "appointment_id"],
        "isDefault": True,
    },
    {
        "eventType": "appointment_cancellation",
        "channel": "sms",
        "language": "en",
        "subject": None,
        "body": "Hi {{patient_name}}, your appointment at {{clinic_name}} on {{date}} has been cancelled. Please call us to reschedule.",
        "variables": ["patient_name", "clinic_name", "date"],
        "isDefault": True,
    },
    {
        "eventType": "lab_results",
        "channel": "sms",
        "language": "en",
        "subject": None,
        "body": "Hi {{patient_name}}, your lab results from {{clinic_name}} are now ready. Please log in to your portal or visit the clinic.",
        "variables": ["patient_name", "clinic_name"],
        "isDefault": True,
    },
    {
        "eventType": "payment_receipt",
        "channel": "email",
        "language": "en",
        "subject": "Payment Receipt — Invoice #{{invoice_no}}",
        "body": "Dear {{patient_name}},\n\nThank you for your payment of {{amount}} {{currency}} for Invoice #{{invoice_no}}.\n\nThis serves as your official receipt.\n\n{{clinic_name}}",
        "variables": ["patient_name", "invoice_no", "amount", "currency", "clinic_name"],
        "isDefault": True,
    },
    {
        "eventType": "appointment_reminder",
        "channel": "sms",
        "language": "ar",
        "subject": None,
        "body": "مرحباً {{patient_name}}، تذكير بموعدك في {{clinic_name}} بتاريخ {{date}} الساعة {{time}}.",
        "variables": ["patient_name", "clinic_name", "date", "time"],
        "isDefault": True,
    },
]


class TemplateCreate(BaseModel):
    branchId: Optional[str] = None
    eventType: str = Field(..., max_length=50)
    channel: str = Field(..., max_length=20)
    subject: Optional[str] = Field(None, max_length=255)
    body: str = Field(..., min_length=1)
    variables: List[str] = Field(default_factory=list)
    language: str = Field("en", max_length=5)
    isActive: bool = True


class TemplateUpdate(BaseModel):
    subject: Optional[str] = Field(None, max_length=255)
    body: Optional[str] = None
    variables: Optional[List[str]] = None
    isActive: Optional[bool] = None
    language: Optional[str] = Field(None, max_length=5)


class TemplatePreviewRequest(BaseModel):
    variables: dict = Field(default_factory=dict)


class TemplateGenerate(BaseModel):
    eventType: str
    channel: str
    language: str = "en"
    context: Optional[str] = Field(None, max_length=500)


import re as _re
_VAR_RE = _re.compile(r"\{\{(\w+)\}\}")


def _validate_variables(body: str, subject: Optional[str], declared: List[str]) -> List[str]:
    """Return list of undeclared variable names used in body/subject."""
    used = set(_VAR_RE.findall(body))
    if subject:
        used |= set(_VAR_RE.findall(subject))
    return sorted(used - set(declared))


def _render_template(text: str, variables: dict) -> str:
    """Replace {{var}} placeholders with provided values."""
    def _replace(m: _re.Match) -> str:
        return str(variables.get(m.group(1), m.group(0)))
    return _VAR_RE.sub(_replace, text)


def tpl_to_dict(t: models.NotificationTemplate) -> dict:
    return {
        "id": t.id,
        "branchId": t.branchId,
        "eventType": t.eventType,
        "channel": t.channel,
        "subject": t.subject or "",
        "body": t.body,
        "variables": t.variables or [],
        "language": t.language or "en",
        "isActive": bool(t.isActive),
        "isDefault": bool(t.isDefault),
        "createdAt": t.createdAt.isoformat() if t.createdAt else None,
        "updatedAt": t.updatedAt.isoformat() if t.updatedAt else None,
    }


def _seed_defaults(db: Session):
    for tpl in DEFAULT_TEMPLATES:
        exists = db.query(models.NotificationTemplate).filter(
            models.NotificationTemplate.branchId == None,
            models.NotificationTemplate.eventType == tpl["eventType"],
            models.NotificationTemplate.channel == tpl["channel"],
            models.NotificationTemplate.language == tpl["language"],
        ).first()
        if not exists:
            db.add(models.NotificationTemplate(
                id=generate_id(),
                branchId=None,
                eventType=tpl["eventType"],
                channel=tpl["channel"],
                subject=tpl.get("subject"),
                body=tpl["body"],
                variables=tpl.get("variables", []),
                language=tpl["language"],
                isDefault=True,
            ))
    db.commit()


@router.post("/generate")
def generate_template_ai(
    body: TemplateGenerate,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("SUPER_ADMIN", "CLINIC_MANAGER")),
):
    import os, json as _j
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(400, "ANTHROPIC_API_KEY is not configured on this server")
    if body.eventType not in VALID_EVENT_TYPES:
        raise HTTPException(422, f"Invalid eventType")
    if body.channel not in VALID_CHANNELS:
        raise HTTPException(422, "Invalid channel")
    if body.language not in VALID_LANGUAGES:
        raise HTTPException(422, "Invalid language")

    lang_label = "Arabic" if body.language == "ar" else "English"
    channel_hints = {
        "email": "email message (include a subject line; can be multiple paragraphs)",
        "sms": "SMS (max 160 characters; plain text only; no subject)",
        "whatsapp": "WhatsApp message (can use emoji and *bold* formatting; no subject)",
    }
    prompt = (
        f"Generate a medical clinic notification template.\n"
        f"Event: {body.eventType.replace('_', ' ')}\n"
        f"Channel: {channel_hints[body.channel]}\n"
        f"Language: {lang_label}\n"
        + (f"Extra context: {body.context}\n" if body.context else "")
        + "\nAvailable placeholders: {{patient_name}}, {{clinic_name}}, {{date}}, {{time}}, "
        "{{appointment_id}}, {{doctor_name}}, {{invoice_no}}, {{amount}}, {{currency}}\n"
        "Use only the placeholders that are relevant to the event type.\n\n"
        'Return ONLY valid JSON (no markdown code fences) in this exact shape:\n'
        '{"subject": "..." or null, "body": "...", "variables": ["var1", "var2"]}'
    )
    try:
        import anthropic as _anthropic
        client = _anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        result = _j.loads(raw)
        return {
            "subject": result.get("subject"),
            "body": result.get("body", ""),
            "variables": result.get("variables", []),
        }
    except _j.JSONDecodeError:
        raise HTTPException(502, "AI returned invalid JSON — try again")
    except Exception as e:
        raise HTTPException(502, f"AI generation failed: {str(e)[:200]}")


@router.get("")
def list_templates(
    branch_id: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
    language: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("SUPER_ADMIN", "CLINIC_MANAGER")),
):
    _seed_defaults(db)
    q = db.query(models.NotificationTemplate)
    if branch_id:
        q = q.filter((models.NotificationTemplate.branchId == branch_id) | (models.NotificationTemplate.branchId == None))
    else:
        q = q.filter(models.NotificationTemplate.branchId == None)
    if event_type:
        q = q.filter(models.NotificationTemplate.eventType == event_type)
    if channel:
        q = q.filter(models.NotificationTemplate.channel == channel)
    if language:
        q = q.filter(models.NotificationTemplate.language == language)
    results = q.order_by(models.NotificationTemplate.eventType, models.NotificationTemplate.channel).all()
    return [tpl_to_dict(t) for t in results]


@router.post("", status_code=201)
def create_template(
    body: TemplateCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles("SUPER_ADMIN", "CLINIC_MANAGER")),
):
    if body.eventType not in VALID_EVENT_TYPES:
        raise HTTPException(422, f"Invalid eventType. Valid: {', '.join(sorted(VALID_EVENT_TYPES))}")
    if body.channel not in VALID_CHANNELS:
        raise HTTPException(422, f"Invalid channel. Valid: {', '.join(sorted(VALID_CHANNELS))}")
    if body.language not in VALID_LANGUAGES:
        raise HTTPException(422, "Invalid language. Valid: en, ar")
    if body.branchId and not db.query(models.Branch).filter(models.Branch.id == body.branchId).first():
        raise HTTPException(404, "Branch not found")

    exists = db.query(models.NotificationTemplate).filter(
        models.NotificationTemplate.branchId == body.branchId,
        models.NotificationTemplate.eventType == body.eventType,
        models.NotificationTemplate.channel == body.channel,
        models.NotificationTemplate.language == body.language,
    ).first()
    if exists:
        raise HTTPException(409, "A template for this event/channel/language already exists for this branch")

    # Validate that body doesn't use undeclared variables
    undeclared = _validate_variables(body.body, body.subject, body.variables)
    if undeclared:
        from fastapi import HTTPException as _H
        raise _H(422, f"Body references undeclared variables: {', '.join(undeclared)}. Add them to the variables list.")

    tpl = models.NotificationTemplate(
        id=generate_id(),
        branchId=body.branchId,
        eventType=body.eventType,
        channel=body.channel,
        subject=body.subject,
        body=body.body,
        variables=body.variables,
        language=body.language,
        isActive=body.isActive,
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    log_audit(db, user.id, "CREATE", "NotificationTemplate", tpl.id, {"eventType": tpl.eventType, "channel": tpl.channel})
    return tpl_to_dict(tpl)


@router.patch("/{template_id}")
def update_template(
    template_id: str,
    body: TemplateUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_roles("SUPER_ADMIN", "CLINIC_MANAGER")),
):
    tpl = db.query(models.NotificationTemplate).filter(models.NotificationTemplate.id == template_id).first()
    if not tpl:
        raise HTTPException(404, "Template not found")
    if body.language and body.language not in VALID_LANGUAGES:
        raise HTTPException(422, "Invalid language")
    updates = body.model_dump(exclude_none=True)

    new_body = updates.get("body", tpl.body)
    new_subject = updates.get("subject", tpl.subject)
    new_vars = updates.get("variables", tpl.variables or [])
    undeclared = _validate_variables(new_body, new_subject, new_vars)
    if undeclared:
        raise HTTPException(422, f"Body references undeclared variables: {', '.join(undeclared)}. Add them to the variables list.")

    for field, val in updates.items():
        setattr(tpl, field, val)
    db.commit()
    db.refresh(tpl)
    log_audit(db, user.id, "UPDATE", "NotificationTemplate", tpl.id, {"eventType": tpl.eventType})
    return tpl_to_dict(tpl)


@router.post("/{template_id}/preview")
def preview_template(
    template_id: str,
    body: TemplatePreviewRequest,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("SUPER_ADMIN", "CLINIC_MANAGER")),
):
    tpl = db.query(models.NotificationTemplate).filter(models.NotificationTemplate.id == template_id).first()
    if not tpl:
        raise HTTPException(404, "Template not found")
    rendered_body = _render_template(tpl.body, body.variables)
    rendered_subject = _render_template(tpl.subject, body.variables) if tpl.subject else None
    return {
        "subject": rendered_subject,
        "body": rendered_body,
        "channel": tpl.channel,
        "language": tpl.language,
    }


@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles("SUPER_ADMIN")),
):
    tpl = db.query(models.NotificationTemplate).filter(models.NotificationTemplate.id == template_id).first()
    if not tpl:
        raise HTTPException(404, "Template not found")
    if tpl.isDefault:
        raise HTTPException(409, "Cannot delete default system templates")
    db.delete(tpl)
    db.commit()
    log_audit(db, user.id, "DELETE", "NotificationTemplate", template_id, {})
