"""Student outcome tracking — 6-month follow-up on actual stream/career choice."""

import logging
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta

from database import get_db
from models import Student, StudentOutcome, Session as SessionModel, School
from routers.auth import get_current_user
from permissions import require_role
from services.whatsapp import send_text_message

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_user)])

# Separate public router — no auth (parents submit from WhatsApp link)
public_router = APIRouter()


class PublicOutcomeRecord(BaseModel):
    student_id: int
    actual_stream_chosen: str = ""
    actual_career_interest: str = ""
    notes: str = ""


@public_router.post("/public", status_code=201)
def public_record_outcome(req: PublicOutcomeRecord, db: Session = Depends(get_db)):
    """Accept a 6-month follow-up response from a parent (no auth required)."""
    student = db.query(Student).filter(Student.id == req.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    existing = db.query(StudentOutcome).filter(StudentOutcome.student_id == req.student_id).first()
    if existing:
        existing.actual_stream_chosen = req.actual_stream_chosen
        existing.actual_career_interest = req.actual_career_interest
        existing.notes = req.notes
        existing.collected_via = "whatsapp"
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
    else:
        o = StudentOutcome(
            student_id=req.student_id,
            actual_stream_chosen=req.actual_stream_chosen,
            actual_career_interest=req.actual_career_interest,
            notes=req.notes,
            collected_via="whatsapp",
        )
        db.add(o)
        db.commit()

    logger.info(f"Public outcome recorded for student {req.student_id}: stream={req.actual_stream_chosen}")
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
def record_outcome(req: OutcomeRecord, db: Session = Depends(get_db), user: dict = Depends(require_role("admin", "counsellor"))):
    """Record or update the actual outcome for a student (idempotent)."""
    student = db.query(Student).filter(Student.id == req.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    existing = db.query(StudentOutcome).filter(StudentOutcome.student_id == req.student_id).first()
    if existing:
        existing.actual_stream_chosen = req.actual_stream_chosen
        existing.actual_career_interest = req.actual_career_interest
        existing.recommendation_matched = req.recommendation_matched
        existing.notes = req.notes
        existing.collected_via = req.collected_via
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        logger.info(f"Outcome updated for student {req.student_id}")
        return _outcome_row(existing, student.name)

    o = StudentOutcome(
        student_id=req.student_id,
        actual_stream_chosen=req.actual_stream_chosen,
        actual_career_interest=req.actual_career_interest,
        recommendation_matched=req.recommendation_matched,
        notes=req.notes,
        collected_via=req.collected_via,
    )
    db.add(o)
    db.commit()
    db.refresh(o)
    logger.info(f"Outcome recorded for student {req.student_id}: stream={req.actual_stream_chosen}, matched={req.recommendation_matched}")
    return _outcome_row(o, student.name)


@router.get("/student/{student_id}")
def get_outcome(student_id: int, db: Session = Depends(get_db)):
    """Get the recorded outcome for a student."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    outcome = db.query(StudentOutcome).filter(StudentOutcome.student_id == student_id).first()
    if not outcome:
        raise HTTPException(status_code=404, detail="No outcome recorded yet")
    return _outcome_row(outcome, student.name)


@router.get("/session/{session_id}")
def session_outcomes(session_id: int, db: Session = Depends(get_db)):
    """All outcomes for a session with recommendation-match stats."""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

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

@router.post("/followup/{session_id}")
async def send_followup(session_id: int, db: Session = Depends(get_db), user: dict = Depends(require_role("admin", "counsellor"))):
    """Send 6-month WhatsApp follow-up asking which stream student chose."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=180)
    base_url = os.getenv("APP_BASE_URL", "https://careerneeti.in")

    students = db.query(Student).filter(
        Student.session_id == session_id,
        Student.delivery_status.in_(["sent", "delivered"]),
        Student.delivery_timestamp <= cutoff,
        Student.parent_phone != "",
    ).all()

    # Exclude students who already have outcomes recorded
    existing_ids = {
        o.student_id for o in db.query(StudentOutcome.student_id).filter(
            StudentOutcome.student_id.in_([s.id for s in students])
        ).all()
    }
    eligible = [s for s in students if s.id not in existing_ids]

    if not eligible:
        return {"message": "No eligible students (6 months not passed or outcomes already recorded)", "sent": 0}

    sent, failed = 0, 0
    for student in eligible:
        outcome_url = f"{base_url}/outcome?sid={student.id}"
        text = (
            f"Namaste! 🙏\n\n"
            f"It's been 6 months since {student.name} received their CareerNeeti report.\n\n"
            f"We'd love to know — which stream did {student.name} choose? "
            f"Your response helps us improve guidance for thousands of students:\n"
            f"👉 {outcome_url}\n\n"
            f"Takes less than 1 minute. Thank you! 🌟\n"
            f"— CareerNeeti Team"
        )
        result = await send_text_message(student.parent_phone, text)
        if result["success"]:
            sent += 1
        else:
            failed += 1
            logger.warning(f"Follow-up send failed for {student.name}: {result.get('error')}")

    return {"sent": sent, "failed": failed, "total": len(eligible)}
