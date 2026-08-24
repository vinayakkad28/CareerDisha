"""Tenant scoping and role checks.

Replaces ``permissions.scope_query_by_school``, which could not work: it filtered
``model_class.school_id``, but ``Student`` has no ``school_id`` column — ownership
is only reachable through ``Student.session_id -> Session.school_id``. It also
returned the *unfiltered* query when the user had no school, i.e. it failed open,
in a function whose entire purpose is to fail closed. It was imported once and
never called.

The design here is that the safe path is the only convenient path: endpoints
declare ``Depends(get_scoped_student)`` and receive an already-authorised row,
so there is no unfiltered query to forget to filter.
"""

from dataclasses import dataclass

import sqlalchemy as sa
from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from database import get_db
from models import SchoolAssignment, Session as SessionModel, Student, User
from routers.auth import get_current_user

SUPERUSER_ROLE = "admin"


@dataclass(frozen=True)
class AccessScope:
    """The set of schools a request is allowed to touch."""

    role: str
    user_id: int
    is_superuser: bool
    school_ids: frozenset[int]

    def assert_school(self, school_id: int | None) -> None:
        """Raise 404 unless this scope covers ``school_id``."""
        if self.is_superuser:
            return
        if school_id is None or school_id not in self.school_ids:
            # 404 rather than 403: it keeps sequential ids from being
            # enumerable, and the API client logs the user out on 403, which
            # would sign someone out for following a stale link.
            raise HTTPException(status_code=404, detail="Not found")


def resolve_scope(
    user: dict = Depends(get_current_user),
    db: DBSession = Depends(get_db),
) -> AccessScope:
    """Resolve the caller's school set from the database on every request.

    Deliberately not read from the JWT: assignments change while a 24-hour token
    is still valid, and a revoked assignment must stop granting access at once.
    """
    role = user.get("role") or ""
    user_id = user.get("user_id") or 0

    if role == SUPERUSER_ROLE:
        # Covers both the shared-password bootstrap token (user_id=0, no school)
        # and a real admin User row.
        return AccessScope(role, user_id, True, frozenset())

    if role not in ("counsellor", "school_admin"):
        raise HTTPException(status_code=403, detail="Unknown role")
    if not user_id:
        # A non-admin token with no user_id cannot be scoped. Deny rather than
        # guess — guessing is what made the old helper fail open.
        raise HTTPException(status_code=403, detail="Token cannot be scoped; please log in again")

    row = db.get(User, user_id)
    if row is None or not row.is_active:
        raise HTTPException(status_code=401, detail="User is no longer active")

    school_ids = {row.school_id} if row.school_id else set()
    if row.role == "counsellor":
        school_ids.update(
            db.scalars(
                select(SchoolAssignment.school_id).where(
                    SchoolAssignment.counsellor_id == user_id,
                    SchoolAssignment.is_active.is_(True),
                )
            )
        )

    # Trust the stored role over the token's, so a demotion takes effect
    # immediately rather than at token expiry.
    return AccessScope(row.role, user_id, row.role == SUPERUSER_ROLE, frozenset(school_ids))


def require_role(*allowed_roles: str):
    """Dependency enforcing that the caller holds one of ``allowed_roles``."""

    def check_role(scope: AccessScope = Depends(resolve_scope)) -> AccessScope:
        if scope.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient permissions. Required: {', '.join(allowed_roles)}.",
            )
        return scope

    return check_role


def scoped_sessions(scope: AccessScope, db: DBSession):
    """Query over the Sessions this scope may see."""
    q = db.query(SessionModel)
    if scope.is_superuser:
        return q
    if not scope.school_ids:
        # No schools means no rows. The old helper returned everything here.
        return q.filter(sa.false())
    return q.filter(SessionModel.school_id.in_(scope.school_ids))


def scoped_students(scope: AccessScope, db: DBSession):
    """Query over the Students this scope may see, joined via their Session."""
    q = db.query(Student)
    if scope.is_superuser:
        return q
    if not scope.school_ids:
        return q.filter(sa.false())
    return q.join(SessionModel, Student.session_id == SessionModel.id).filter(
        SessionModel.school_id.in_(scope.school_ids)
    )


def get_scoped_student(
    student_id: int,
    scope: AccessScope = Depends(resolve_scope),
    db: DBSession = Depends(get_db),
) -> Student:
    """Resolve a Student the caller is allowed to see, or 404."""
    student = scoped_students(scope, db).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


def get_scoped_session(
    session_id: int,
    scope: AccessScope = Depends(resolve_scope),
    db: DBSession = Depends(get_db),
) -> SessionModel:
    """Resolve a Session the caller is allowed to see, or 404."""
    session = scoped_sessions(scope, db).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def student_from_report_token(token: str, db: DBSession) -> Student:
    """Resolve a Student from the per-student report token, for public endpoints.

    Parents reach the feedback and outcome forms from a WhatsApp link with no
    login. The token is the only thing standing between those endpoints and
    anyone writing to any student's record by guessing a sequential id, so it
    must actually be checked — the feedback endpoint previously declared a
    `token` field, commented it as spam prevention, and never read it.

    report_token is a 32-char uuid4 hex assigned during report generation
    (tasks/batch_processor.py), so it exists by the time either survey is sent.
    """
    if not token or len(token) < 16:
        raise HTTPException(status_code=403, detail="Invalid or missing link token")
    student = db.query(Student).filter(Student.report_token == token).first()
    if student is None:
        raise HTTPException(status_code=403, detail="Invalid or missing link token")
    return student
