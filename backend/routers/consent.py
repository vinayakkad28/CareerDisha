import secrets
import string
import logging
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timezone
from access import (
    AccessScope,
    get_scoped_session,
    get_scoped_student,
    require_role,
    resolve_scope,
    scoped_students,
)
from database import get_db
from utils.time import utcnow
from models import Student, Session as SessionModel

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(resolve_scope)])

# The WhatsApp OTP consent flow was removed with the WhatsApp integration. It had
# no caller — no frontend screen, no test — and its delivery path was a lazy
# import inside a bare except, so without the service it would have returned HTTP
# 200 claiming success while the code was neither sent nor even logged.
#
# Consent for the pilot is the signed paper circular collected at the school
# session, recorded below and inherited by any online assessment that redeems
# that session's access code (see routers/d2c.py::_inherited_consent).
#
# Removing the in-process store also lifts the single-worker constraint it
# imposed on deployment.
class ConsentUpdate(BaseModel):
    student_ids: list[int]
    consent_method: str = "paper_form"
    consent_parent_name: str = ""


@router.post("/sessions/{session_id}/record-consent")
def record_consent(
    session_id: int,
    data: ConsentUpdate,
    db: Session = Depends(get_db),
    session: SessionModel = Depends(get_scoped_session),
):
    """Record parental consent for students in a session."""
    updated = 0
    for sid in data.student_ids:
        student = db.query(Student).filter(Student.id == sid, Student.session_id == session_id).first()
        if student:
            student.consent_obtained = True
            student.consent_timestamp = datetime.now(timezone.utc)
            student.consent_parent_name = data.consent_parent_name or student.parent_name
            student.consent_method = data.consent_method
            updated += 1
    db.commit()
    return {"message": f"Consent recorded for {updated} students", "updated": updated}


@router.post("/sessions/{session_id}/bulk-consent")
def bulk_consent(
    session_id: int,
    db: Session = Depends(get_db),
    session: SessionModel = Depends(get_scoped_session),
    _: object = Depends(require_role("admin", "counsellor")),
):
    """Mark all students in session as having paper-form consent (common for school sessions)."""
    students = db.query(Student).filter(Student.session_id == session_id).all()
    for s in students:
        s.consent_obtained = True
        s.consent_timestamp = utcnow()
        s.consent_method = "paper_form"
        if not s.consent_parent_name:
            s.consent_parent_name = s.parent_name
    db.commit()
    return {"message": f"Bulk consent recorded for {len(students)} students"}


@router.delete("/students/{student_id}/data")
def delete_student_data(
    db: Session = Depends(get_db),
    student: Student = Depends(get_scoped_student),
    _: object = Depends(require_role("admin")),
):
    """Right to erasure: anonymise all personal data for a student (DPDPA Section 12)."""
    student.name = f"[REDACTED-{student.id}]"
    student.parent_name = ""
    student.parent_phone = ""
    student.riasec_raw_responses = {}
    student.report_content = {}
    student.consent_obtained = False
    student.consent_parent_name = ""
    # Keep: riasec_scores, holland_code, matched_careers for anonymised analytics
    db.commit()
    return {"message": "Student personal data deleted (anonymised)"}


@router.get("/sessions/{session_id}/consent-status")
def consent_status(
    session_id: int,
    db: Session = Depends(get_db),
    session: SessionModel = Depends(get_scoped_session),
):
    """Get consent status for all students in a session."""
    students = db.query(Student).filter(Student.session_id == session_id).all()
    return {
        "session_id": session_id,
        "total": len(students),
        "consented": sum(1 for s in students if s.consent_obtained),
        "pending": sum(1 for s in students if not s.consent_obtained),
        "students": [
            {
                "id": s.id,
                "name": s.name,
                "parent_name": s.parent_name,
                "consent_obtained": s.consent_obtained,
                "consent_timestamp": s.consent_timestamp.isoformat() if s.consent_timestamp else None,
                "consent_method": s.consent_method,
            }
            for s in students
        ],
    }
