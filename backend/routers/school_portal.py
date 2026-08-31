"""School self-service portal — school_admin users can manage their own sessions."""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from access import AccessScope, require_role, resolve_scope, scoped_schools
from database import get_db
from models import School, Session as SessionModel, Student, Feedback, User

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(resolve_scope)])


def _linked_school_id(scope: AccessScope, db: Session) -> int | None:
    """The single school this portal view is about.

    Resolved per request from the caller's scope rather than from a `school_id`
    claim in the JWT, which goes stale the moment an assignment changes and is
    absent entirely on the shared-password admin token. An admin has no implicit
    school, so their own User row is consulted.
    """
    if scope.school_ids:
        return next(iter(scope.school_ids))
    if scope.is_superuser and scope.user_id:
        user = db.get(User, scope.user_id)
        return user.school_id if user else None
    return None


@router.get("/my-school")
def get_my_school(db: Session = Depends(get_db), scope: AccessScope = Depends(require_role("school_admin", "admin", "counsellor"))):
    """Get the school linked to the current user."""
    school_id = _linked_school_id(scope, db)
    if not school_id:
        raise HTTPException(status_code=403, detail="No school linked to your account")
    school = scoped_schools(scope, db).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    sessions = db.query(SessionModel).filter(SessionModel.school_id == school_id).order_by(SessionModel.session_date.desc()).all()
    total_students = sum(s.total_students for s in sessions)
    session_ids = [s.id for s in sessions]
    total_delivered = db.query(Student).filter(
        Student.session_id.in_(session_ids),
        Student.delivery_status == "delivered"
    ).count() if session_ids else 0

    return {
        **{c.name: getattr(school, c.name) for c in school.__table__.columns},
        "total_sessions": len(sessions),
        "total_students": total_students,
        "total_delivered": total_delivered,
        "sessions": [
            {
                "id": s.id,
                "session_date": s.session_date.isoformat() if s.session_date else "",
                "classes_assessed": s.classes_assessed,
                "total_students": s.total_students,
                "status": s.status,
                "counsellor_name": s.counsellor_name,
            }
            for s in sessions
        ],
    }


@router.get("/analytics")
def get_school_analytics(db: Session = Depends(get_db), scope: AccessScope = Depends(require_role("school_admin", "admin"))):
    """Get analytics for the school — RIASEC distribution, stream recommendations, top careers."""
    school_id = _linked_school_id(scope, db)
    if not school_id:
        raise HTTPException(status_code=403, detail="No school linked to your account")

    sessions = db.query(SessionModel).filter(SessionModel.school_id == school_id).all()
    session_ids = [s.id for s in sessions]
    students = db.query(Student).filter(Student.session_id.in_(session_ids)).all() if session_ids else []

    if not students:
        return {"message": "No student data available", "total_students": 0}

    riasec_totals = {t: 0.0 for t in "RIASEC"}
    riasec_count = 0
    stream_dist = {}
    career_freq = {}
    class_dist = {}

    for s in students:
        scores = s.riasec_scores or {}
        if scores:
            riasec_count += 1
            for t in "RIASEC":
                riasec_totals[t] += scores.get(t, 0)

        if s.holland_code:
            primary = s.holland_code[0]
            if primary in ("R", "I"):
                stream = "Science (PCM)"
            elif primary == "S":
                stream = "Science (PCB)"
            elif primary in ("E", "C"):
                stream = "Commerce"
            elif primary == "A":
                stream = "Arts/Humanities"
            else:
                stream = "Undecided"
            stream_dist[stream] = stream_dist.get(stream, 0) + 1

        for mc in (s.matched_careers or [])[:2]:
            name = mc.get("career_name", "")
            if name:
                career_freq[name] = career_freq.get(name, 0) + 1

        cls = str(s.class_level)
        class_dist[cls] = class_dist.get(cls, 0) + 1

    riasec_avg = {t: round(riasec_totals[t] / riasec_count, 1) if riasec_count else 0 for t in "RIASEC"}
    top_careers = sorted(career_freq.items(), key=lambda x: -x[1])[:15]

    # NPS + satisfaction from Feedback table
    student_ids = [s.id for s in students]
    feedbacks = db.query(Feedback).filter(Feedback.student_id.in_(student_ids)).all() if student_ids else []
    ratings = [f.rating for f in feedbacks if f.rating is not None]
    avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else None
    nps_responses = [f for f in feedbacks if f.would_recommend is not None]
    promoters = sum(1 for f in nps_responses if f.would_recommend is True)
    detractors = sum(1 for f in nps_responses if f.would_recommend is False)
    nps = round(((promoters - detractors) / len(nps_responses)) * 100) if nps_responses else None

    return {
        "total_students": len(students),
        "total_sessions": len(sessions),
        "riasec_averages": riasec_avg,
        "stream_distribution": stream_dist,
        "top_careers": [{"name": c, "count": n} for c, n in top_careers],
        "class_distribution": class_dist,
        "consent_rate": round(sum(1 for s in students if s.consent_obtained) / len(students) * 100, 1) if students else 0,
        "report_completion_rate": round(sum(1 for s in students if s.report_status in ("pdf_ready", "delivered")) / len(students) * 100, 1) if students else 0,
        "nps": nps,
        "avg_rating": avg_rating,
        "feedback_responses": len(feedbacks),
    }
