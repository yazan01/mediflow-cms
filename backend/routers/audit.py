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
    entityId: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
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
