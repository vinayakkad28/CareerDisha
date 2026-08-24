"""Parent NPS (Net Promoter Score) survey endpoints."""

import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional

from access import get_scoped_session, resolve_scope, student_from_report_token
from database import get_db
from models import Student, Session as SessionModel, School
from utils.time import utcnow

logger = logging.getLogger(__name__)

# Staff-facing aggregates.
router = APIRouter(dependencies=[Depends(resolve_scope)])

# Parents submit from a WhatsApp link and have no login. The submit endpoint
# previously sat behind get_current_user, so the audience it was written for
# ("Record an NPS response from a parent") could never reach it — and no
# frontend called it either. It now follows the same pattern as feedback.py and
# outcomes.py: a separate public router authenticated by the report token.
public_router = APIRouter()


class NPSResponse(BaseModel):
    # Identified by the per-student report token, not a guessable id.
    token: str
    score: int = Field(ge=0, le=10)
    feedback: str = Field(default="", max_length=500)
    parent_phone: str = Field(default="", max_length=15)


@public_router.post("/submit")
def submit_nps(response: NPSResponse, db: Session = Depends(get_db)):
    """Record an NPS response from a parent."""
    student = student_from_report_token(response.token, db)

    nps_data = {
        "score": response.score,
        "feedback": response.feedback,
        "submitted_at": utcnow().isoformat(),
        "parent_phone": response.parent_phone or student.parent_phone,
    }

    # Store on report_content as an addition
    content = student.report_content or {}
    content["nps"] = nps_data
    student.report_content = content
    db.commit()

    logger.info(f"NPS recorded for {student.name}: score={nps_data['score']}")
    return {"message": "Thank you for your feedback!", "score": nps_data["score"]}


@router.get("/session/{session_id}")
def session_nps_summary(
    session_id: int,
    db: Session = Depends(get_db),
    session: SessionModel = Depends(get_scoped_session),
):
    """Get NPS summary for a session."""
    students = db.query(Student).filter(Student.session_id == session_id).all()

    scores = []
    feedback_list = []
    for s in students:
        content = s.report_content or {}
        nps = content.get("nps")
        if nps:
            scores.append(nps["score"])
            if nps.get("feedback"):
                feedback_list.append({
                    "student": s.name,
                    "score": nps["score"],
                    "feedback": nps["feedback"],
                })

    if not scores:
        return {
            "session_id": session_id,
            "total_responses": 0,
            "nps_score": None,
            "message": "No NPS responses yet",
        }

    # Calculate NPS: % promoters (9-10) minus % detractors (0-6)
    promoters = sum(1 for s in scores if s >= 9) / len(scores) * 100
    detractors = sum(1 for s in scores if s <= 6) / len(scores) * 100
    nps = round(promoters - detractors)

    return {
        "session_id": session_id,
        "total_responses": len(scores),
        "total_students": len(students),
        "response_rate": round(len(scores) / len(students) * 100, 1) if students else 0,
        "nps_score": nps,
        "average_score": round(sum(scores) / len(scores), 1),
        "promoters": sum(1 for s in scores if s >= 9),
        "passives": sum(1 for s in scores if 7 <= s <= 8),
        "detractors": sum(1 for s in scores if s <= 6),
        "feedback": feedback_list,
    }
