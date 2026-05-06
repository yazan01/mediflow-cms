from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("")
def get_audit_logs(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    module: Optional[str] = None,
    userId: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = db.query(models.AuditLog)

    if module and module != "ALL":
        query = query.filter(models.AuditLog.module == module)
    if userId:
        query = query.filter(models.AuditLog.userId == userId)

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
