"""Audit log endpoint — DPDPA compliance trail."""
import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import AuditLog
from routers.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_user)])


def log_audit(db: Session, action: str, entity_type: str = "", entity_id: int = None,
              detail: str = "", user_id: int = None, ip_address: str = ""):
    """Write one audit record. Call from any router or background task."""
    entry = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        detail=detail,
        ip_address=ip_address,
    )
    db.add(entry)
    db.commit()


@router.get("/logs")
def list_audit_logs(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    entity_type: str = Query("", description="Filter by entity type"),
    action: str = Query("", description="Filter by action keyword"),
):
    """Return paginated audit log (admin-only)."""
    if user.get("role") != "admin":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin access required")

    q = db.query(AuditLog).order_by(AuditLog.timestamp.desc())
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if action:
        q = q.filter(AuditLog.action.contains(action))

    total = q.count()
    rows = q.offset(offset).limit(limit).all()
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "logs": [
            {
                "id": r.id,
                "user_id": r.user_id,
                "action": r.action,
                "entity_type": r.entity_type,
                "entity_id": r.entity_id,
                "detail": r.detail,
                "ip_address": r.ip_address,
                "timestamp": r.timestamp.isoformat(),
            }
            for r in rows
        ],
    }
