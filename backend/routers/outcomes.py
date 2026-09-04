"""Student outcome tracking — 6-month follow-up on actual stream/career choice."""

import logging
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta

from access import (
    AccessScope,
    get_scoped_session,
    get_scoped_student,
    require_role,
    resolve_scope,
    scoped_students,
    student_from_report_token,
)
from utils.time import utcnow
from database import get_db
from models import Student, StudentOutcome, Session as SessionModel, School

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(resolve_scope)])

# Separate public router — no auth (parents submit from WhatsApp link)
public_router = APIRouter()


class PublicOutcomeRecord(BaseModel):
    # Identified by the per-student report token. Previously this required only
    # student_id with no token at all, so anyone could overwrite any student's
    # outcome — and outcomes feed recommendation_accuracy_pct on the dashboard.
    token: str
    actual_stream_chosen: str = ""
    actual_career_interest: str = ""
    notes: str = ""


@public_router.post("/public", status_code=201)
def public_record_outcome(req: PublicOutcomeRecord, db: Session = Depends(get_db)):
    """Accept a 6-month follow-up response from a parent (no auth required)."""
    student = student_from_report_token(req.token, db)

    existing = db.query(StudentOutcome).filter(StudentOutcome.student_id == student.id).first()
    if existing:
        existing.actual_stream_chosen = req.actual_stream_chosen
        existing.actual_career_interest = req.actual_career_interest
        existing.notes = req.notes
        existing.collected_via = "whatsapp"
        existing.updated_at = utcnow()
        db.commit()
    else:
        o = StudentOutcome(
            student_id=student.id,
            actual_stream_chosen=req.actual_stream_chosen,
            actual_career_interest=req.actual_career_interest,
            notes=req.notes,
            collected_via="form",
        )
        db.add(o)
        db.commit()

    logger.info(f"Public outcome recorded for student {student.id}: stream={req.actual_stream_chosen}")
    return {"message": "Thank you! Your response has been recorded."}


# ── Schemas ───────────────────────────────────────────────────────────────────

class OutcomeRecord(BaseModel):
    student_id: int
    actual_stream_chosen: str = ""
    actual_career_interest: str = ""
    recommendation_matched: Optional[bool] = None
    notes: str = ""
    collected_via: str = "manual"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _outcome_row(o: StudentOutcome, student_name: str = "") -> dict:
    return {
        "id": o.id,
        "student_id": o.student_id,
        "student_name": student_name,
        "actual_stream_chosen": o.actual_stream_chosen,
        "actual_career_interest": o.actual_career_interest,
        "recommendation_matched": o.recommendation_matched,
        "notes": o.notes,
        "collected_via": o.collected_via,
        "updated_at": o.updated_at.isoformat() if o.updated_at else "",
    }


# ── Record / update outcome ───────────────────────────────────────────────────

@router.post("/record", status_code=201)
def record_outcome(
    req: OutcomeRecord,
    db: Session = Depends(get_db),
    scope: AccessScope = Depends(require_role("admin", "counsellor")),
):
    """Record or update the actual outcome for a student (idempotent).

    Staff-facing, so the student is addressed by id and resolved through the
    caller's schools. The parent-facing counterpart is /public, which uses the
    report token instead because parents have no login.
    """
    student = scoped_students(scope, db).filter(Student.id == req.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    existing = db.query(StudentOutcome).filter(StudentOutcome.student_id == student.id).first()
    if existing:
        existing.actual_stream_chosen = req.actual_stream_chosen
        existing.actual_career_interest = req.actual_career_interest
        existing.recommendation_matched = req.recommendation_matched
        existing.notes = req.notes
        existing.collected_via = req.collected_via
        existing.updated_at = utcnow()
        db.commit()
        logger.info(f"Outcome updated for student {student.id}")
        return _outcome_row(existing, student.name)

    o = StudentOutcome(
        student_id=student.id,
        actual_stream_chosen=req.actual_stream_chosen,
        actual_career_interest=req.actual_career_interest,
        recommendation_matched=req.recommendation_matched,
        notes=req.notes,
        collected_via=req.collected_via,
    )
    db.add(o)
    db.commit()
    db.refresh(o)
    logger.info(f"Outcome recorded for student {student.id}: stream={req.actual_stream_chosen}, matched={req.recommendation_matched}")
    return _outcome_row(o, student.name)


@router.get("/student/{student_id}")
def get_outcome(
    db: Session = Depends(get_db),
    student: Student = Depends(get_scoped_student),
):
    """Get the recorded outcome for a student."""
    outcome = db.query(StudentOutcome).filter(StudentOutcome.student_id == student.id).first()
    if not outcome:
        raise HTTPException(status_code=404, detail="No outcome recorded yet")
    return _outcome_row(outcome, student.name)


@router.get("/session/{session_id}")
def session_outcomes(
    session_id: int,
    db: Session = Depends(get_db),
    session: SessionModel = Depends(get_scoped_session),
):
    """All outcomes for a session with recommendation-match stats."""

    students = db.query(Student).filter(Student.session_id == session_id).all()
    student_map = {s.id: s for s in students}
    outcomes = db.query(StudentOutcome).filter(
        StudentOutcome.student_id.in_(list(student_map.keys()))
    ).all()

    rows = [_outcome_row(o, student_map[o.student_id].name) for o in outcomes]

    total = len(students)
    recorded = len(outcomes)
    matched = sum(1 for o in outcomes if o.recommendation_matched is True)
    not_matched = sum(1 for o in outcomes if o.recommendation_matched is False)
    match_total = matched + not_matched
    accuracy_pct = round(matched / match_total * 100, 1) if match_total else None

    return {
        "session_id": session_id,
        "total_students": total,
        "outcomes_recorded": recorded,
        "response_rate_pct": round(recorded / total * 100, 1) if total else 0,
        "recommendation_accuracy_pct": accuracy_pct,
        "outcomes": rows,
    }


# ── WhatsApp follow-up ────────────────────────────────────────────────────────
