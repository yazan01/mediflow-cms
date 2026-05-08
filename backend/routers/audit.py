from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func as _func

from database import get_db
from auth import get_current_user, require_roles, log_audit
import models

router = APIRouter(prefix="/api/audit", tags=["audit"])


class ArchiveRequest(BaseModel):
    olderThanDays: int = Field(90, ge=30, le=3650)


@router.get("/retention-stats")
def get_retention_stats(
    db: Session = Depends(get_db),
    _user=Depends(require_roles("SUPER_ADMIN", "AUDITOR")),
):
    total = db.query(_func.count(models.AuditLog.id)).scalar() or 0
    oldest = db.query(_func.min(models.AuditLog.timestamp)).scalar()
    return {
        "totalLogs": total,
        "oldestLog": oldest.isoformat() if oldest else None,
    }


@router.post("/archive")
def archive_audit_logs(
    body: ArchiveRequest,
    db: Session = Depends(get_db),
    user=Depends(require_roles("SUPER_ADMIN")),
):
    cutoff = datetime.now() - timedelta(days=body.olderThanDays)
    deleted = db.query(models.AuditLog).filter(models.AuditLog.timestamp < cutoff).delete(synchronize_session=False)
    db.commit()
    log_audit(db, user.id, "ARCHIVE", "AuditLog", None, {"olderThanDays": body.olderThanDays, "deleted": deleted})
    return {"deleted": deleted, "cutoffDate": cutoff.isoformat()}


@router.get("")
def get_audit_logs(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    module: Optional[str] = None,
    userId: Optional[str] = None,
    entityId: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("SUPER_ADMIN", "CLINIC_MANAGER", "AUDITOR")),
):
    from sqlalchemy.orm import joinedload
    from sqlalchemy import or_
    query = db.query(models.AuditLog)

    if module and module != "ALL":
        query = query.filter(models.AuditLog.module == module)
    if userId:
        query = query.filter(models.AuditLog.userId == userId)
    if entityId:
        query = query.filter(models.AuditLog.entityId == entityId)
    if search:
        query = query.join(models.User, isouter=True).filter(
            or_(
                models.AuditLog.action.contains(search),
                models.User.name.contains(search),
            )
        )

    total = query.count()
    logs = query.order_by(models.AuditLog.timestamp.desc()).offset((page - 1) * pageSize).limit(pageSize).all()

    return {
        "data": [
            {
                "id": log.id,
                "userId": log.userId,
                "userName": log.user.name if log.user else "",
                "action": log.action,
                "module": log.module,
                "entityId": log.entityId,
                "entityType": log.entityType,
                "ipAddress": log.ipAddress,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            }
            for log in logs
        ],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }
