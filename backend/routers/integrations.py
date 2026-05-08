from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.orm import Session

from database import get_db
from auth import require_roles
import models

router = APIRouter(prefix="/api/settings/integrations", tags=["integrations"])


@router.get("/status")
def get_integration_status(
    branch_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("SUPER_ADMIN", "CLINIC_MANAGER")),
):
    """Returns connectivity status for WhatsApp, SMS, and Payment integrations per branch."""
    q = db.query(models.Branch)
    if branch_id:
        q = q.filter(models.Branch.id == branch_id)
    else:
        q = q.filter(models.Branch.isActive == True)
    branches = q.order_by(models.Branch.name).all()

    results = []
    for b in branches:
        # WhatsApp
        wa = db.query(models.WhatsAppConfig).filter(models.WhatsAppConfig.branchId == b.id).first()
        last_wa_event = (
            db.query(models.WebhookEvent)
            .filter(models.WebhookEvent.branchId == b.id, models.WebhookEvent.source == "whatsapp")
            .order_by(models.WebhookEvent.createdAt.desc())
            .first()
        )
        pending_wa = (
            db.query(models.WebhookEvent)
            .filter(
                models.WebhookEvent.branchId == b.id,
                models.WebhookEvent.source == "whatsapp",
                models.WebhookEvent.processed == False,
            )
            .count()
        )

        # SMS
        sms = db.query(models.SmsConfig).filter(models.SmsConfig.branchId == b.id).first()

        # Payment
        pg = db.query(models.PaymentGatewayConfig).filter(models.PaymentGatewayConfig.branchId == b.id).first()
        last_pg_event = (
            db.query(models.WebhookEvent)
            .filter(models.WebhookEvent.branchId == b.id, models.WebhookEvent.source == "payment")
            .order_by(models.WebhookEvent.createdAt.desc())
            .first()
        )

        results.append({
            "branchId": b.id,
            "branchName": b.name,
            "branchCode": b.code,
            "whatsapp": {
                "configured": bool(wa and wa.phoneNumberId),
                "active": bool(wa and wa.isActive),
                "verified": bool(wa and wa.isVerified),
                "autoReply": bool(wa and wa.autoReplyEnabled),
                "lastWebhook": last_wa_event.createdAt.isoformat() if last_wa_event and last_wa_event.createdAt else None,
                "pendingEvents": pending_wa,
            },
            "sms": {
                "configured": bool(sms and sms.apiKeyEncrypted),
                "active": bool(sms and sms.isActive),
                "provider": sms.provider if sms else None,
            },
            "payment": {
                "configured": bool(pg and pg.publicKey),
                "active": bool(pg and pg.isActive),
                "testMode": bool(pg and pg.testMode),
                "provider": pg.provider if pg else None,
                "lastWebhook": last_pg_event.createdAt.isoformat() if last_pg_event and last_pg_event.createdAt else None,
            },
        })

    return results
