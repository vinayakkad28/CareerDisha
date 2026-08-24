"""Post-delivery parent satisfaction survey."""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from access import get_scoped_session, resolve_scope, student_from_report_token
from database import get_db
from models import Feedback, Session as SessionModel, Student

logger = logging.getLogger(__name__)

# Public router — parents submit from a WhatsApp link, authenticated by the
# per-student report token rather than a login.
router = APIRouter()

# Staff-facing aggregates. Previously these sat on the public router, so anyone
# could read any session's feedback summary.
summary_router = APIRouter(dependencies=[Depends(resolve_scope)])


class FeedbackSubmit(BaseModel):
    # The student is identified BY the token, not by a separate id. Previously
    # both were sent, only student_id was used, and the frontend passed the
    # student's own sequential id as the "token" — so anyone could post
    # unlimited fake ratings for any student.
    token: str
    rating: Optional[int] = None            # 1-5
    recommendation_match: Optional[bool] = None
    most_useful: str = ""
    missing: str = ""
    would_recommend: Optional[bool] = None


@router.post("/submit", status_code=201)
def submit_feedback(req: FeedbackSubmit, db: Session = Depends(get_db)):
    """Accept a parent survey response. Linked from the post-delivery WhatsApp message."""
    student = student_from_report_token(req.token, db)

    # Validate rating range
    if req.rating is not None and req.rating not in range(1, 6):
        raise HTTPException(status_code=400, detail="Rating must be 1-5")

    entry = Feedback(
        student_id=student.id,
        rating=req.rating,
        recommendation_match=req.recommendation_match,
        most_useful=req.most_useful,
        missing=req.missing,
        would_recommend=req.would_recommend,
    )
    db.add(entry)
    db.commit()
    logger.info(f"Feedback received for student {student.id} (rating={req.rating})")
    return {"message": "Thank you for your feedback!"}


@summary_router.get("/session/{session_id}/summary")
def session_feedback_summary(
    session_id: int,
    db: Session = Depends(get_db),
    session: SessionModel = Depends(get_scoped_session),
):
    """Aggregate NPS and rating summary for a session (counsellor-facing)."""
    students = db.query(Student).filter(Student.session_id == session_id).all()
    student_ids = [s.id for s in students]
    if not student_ids:
        return {"session_id": session_id, "total_responses": 0}

    responses = db.query(Feedback).filter(Feedback.student_id.in_(student_ids)).all()
    if not responses:
        return {"session_id": session_id, "total_responses": 0}

    ratings = [r.rating for r in responses if r.rating is not None]
    avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else None

    promoters = sum(1 for r in responses if r.would_recommend is True)
    detractors = sum(1 for r in responses if r.would_recommend is False)
    total_nps = len([r for r in responses if r.would_recommend is not None])
    nps = round(((promoters - detractors) / total_nps) * 100) if total_nps else None

    match_yes = sum(1 for r in responses if r.recommendation_match is True)
    match_total = sum(1 for r in responses if r.recommendation_match is not None)

    return {
        "session_id": session_id,
        "total_responses": len(responses),
        "avg_rating": avg_rating,
        "nps": nps,
        "recommendation_match_pct": round(match_yes / match_total * 100) if match_total else None,
        "response_rate_pct": round(len(responses) / len(students) * 100),
    }
