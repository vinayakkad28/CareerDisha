import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from access import AccessScope, require_role, resolve_scope, scoped_schools
from database import get_db
from models import School, Session as SessionModel
from schemas.schools import SchoolDetail, SchoolSessionSummary, SchoolSummary

logger = logging.getLogger(__name__)

# resolve_scope, not get_current_user. This router was the last one authenticated
# by a raw JWT decode with no ownership check, so any authenticated role —
# including a counsellor assigned to a single school — could list every school,
# read another school's full record together with all of its sessions, rewrite
# another school's contact details with no audit entry, and create schools.
router = APIRouter(dependencies=[Depends(resolve_scope)])


class SchoolCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    code: str = Field(min_length=1, max_length=50)
    city: str = Field(min_length=1, max_length=100)
    board: str = Field(default="CBSE", max_length=20)
    contact_person: str = Field(default="", max_length=255)
    contact_phone: str = Field(default="", max_length=15)


class SchoolUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=255)
    city: Optional[str] = Field(default=None, max_length=100)
    board: Optional[str] = Field(default=None, max_length=20)
    contact_person: Optional[str] = Field(default=None, max_length=255)
    contact_phone: Optional[str] = Field(default=None, max_length=15)


def _audit(db: Session, action: str, school: School, detail: str, scope: AccessScope) -> None:
    """Stage an audit row for the current change.

    Deliberately does NOT commit: routers.audit.log_audit commits, which made the
    trail durable before the mutation it describes, so a failed second commit left
    the log asserting an update that never happened. The caller commits once,
    covering both.

    user_id 0 is the shared-password bootstrap admin and has no users row, so it
    cannot be stored as an FK — but "unattributed" is the wrong record on a
    DPDPA-regulated dataset, so the actor is named in the detail text instead.
    """
    from models import AuditLog

    actor = scope.user_id or None
    if actor is None:
        detail = f"[shared-password admin] {detail}"
    db.add(AuditLog(
        user_id=actor,
        action=action,
        entity_type="school",
        entity_id=school.id,
        detail=detail,
    ))


def _detail(school: School, sessions: list | None = None) -> SchoolDetail:
    """Build a SchoolDetail without touching School.sessions.

    SchoolDetail has a field named `sessions`, so model_validate(school) with
    from_attributes would lazy-load the relationship — duplicating the query in
    get_school and silently attaching every session to the create and update
    responses, which never returned them before.
    """
    data = {
        "id": school.id,
        "name": school.name,
        "code": school.code,
        "city": school.city,
        "board": school.board,
        "contact_person": school.contact_person,
        "contact_phone": school.contact_phone,
        "is_active": school.is_active,
        "created_at": school.created_at,
        "sessions": [SchoolSessionSummary.model_validate(s) for s in (sessions or [])],
    }
    return SchoolDetail.model_validate(data)


@router.get("", response_model=list[SchoolSummary])
def list_schools(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    scope: AccessScope = Depends(resolve_scope),
):
    schools = (
        scoped_schools(scope, db)
        .order_by(School.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    # One grouped query for counts instead of two per school.
    school_ids = [s.id for s in schools] or [-1]
    agg = dict(
        (row[0], (row[1], row[2] or 0))
        for row in db.query(
            SessionModel.school_id,
            func.count(SessionModel.id),
            func.coalesce(func.sum(SessionModel.total_students), 0),
        )
        .filter(SessionModel.school_id.in_(school_ids))
        .group_by(SessionModel.school_id)
        .all()
    )

    out = []
    for s in schools:
        sessions_count, students_count = agg.get(s.id, (0, 0))
        row = SchoolSummary.model_validate(s)
        row.total_sessions = sessions_count
        row.total_students = int(students_count)
        out.append(row)
    return out


@router.post("", status_code=201, response_model=SchoolDetail)
def create_school(
    school: SchoolCreate,
    db: Session = Depends(get_db),
    scope: AccessScope = Depends(require_role("admin")),
):
    """Create a school. Admin only — this previously had no role check at all."""
    existing = db.query(School).filter(School.code == school.code).first()
    if existing and existing.is_active:
        raise HTTPException(status_code=400, detail=f"School with code '{school.code}' already exists")
    if existing:
        # Reactivate rather than reject. Soft delete retains the row, so without
        # this the code is permanently unusable: detail and update both 404 on an
        # inactive school and nothing else sets is_active back to True.
        for field, value in school.model_dump().items():
            setattr(existing, field, value)
        existing.is_active = True
        db_school = existing
        _audit(db, "school.reactivate", db_school, f"Reactivated {db_school.code}", scope)
    else:
        db_school = School(**school.model_dump())
        db.add(db_school)
    db.commit()
    db.refresh(db_school)
    return _detail(db_school)


@router.get("/{school_id}", response_model=SchoolDetail)
def get_school(
    school_id: int,
    db: Session = Depends(get_db),
    scope: AccessScope = Depends(resolve_scope),
):
    school = scoped_schools(scope, db).filter(School.id == school_id).first()
    if not school:
        # 404 rather than 403, matching the rest of the API: ids stay
        # non-enumerable and the client does not log the user out.
        raise HTTPException(status_code=404, detail="School not found")

    sessions = (
        db.query(SessionModel)
        .filter(SessionModel.school_id == school_id)
        .order_by(SessionModel.session_date.desc())
        .all()
    )
    return _detail(school, sessions)


@router.put("/{school_id}", response_model=SchoolDetail)
def update_school(
    school_id: int,
    updates: SchoolUpdate,
    db: Session = Depends(get_db),
    scope: AccessScope = Depends(require_role("admin")),
):
    """Update a school. Admin only, scoped, and recorded.

    Previously any authenticated role could rewrite any school's identity and
    contact details, with no audit entry.
    """
    school = scoped_schools(scope, db).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    changes = updates.model_dump(exclude_unset=True)
    if changes:
        for field, value in changes.items():
            setattr(school, field, value)
        _audit(db, "school.update", school,
               f"Updated {school.code}: {', '.join(sorted(changes))}", scope)
        db.commit()
        db.refresh(school)
    return _detail(school)


@router.delete("/{school_id}")
def delete_school(
    school_id: int,
    db: Session = Depends(get_db),
    scope: AccessScope = Depends(require_role("admin")),
):
    """Deactivate a school.

    This used to be a hard db.delete(), which cascaded through
    Session -> Student (both "all, delete-orphan") and permanently destroyed
    every student record, score, report and consent entry for the school — from
    one API call, with no confirmation and no audit entry, on a DPDPA-regulated
    dataset. It is now a soft delete, and it is recorded.
    """
    school = (
        scoped_schools(scope, db, include_inactive=True)
        .filter(School.id == school_id)
        .first()
    )
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    if not school.is_active:
        return {"detail": "School already deactivated"}

    school.is_active = False
    _audit(db, "school.deactivate", school,
           f"Deactivated {school.name} ({school.code})", scope)
    db.commit()
    return {"detail": "School deactivated"}
