from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import School, Session as SessionModel, Student, StudentOutcome, Feedback
from routers.auth import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total_schools = db.query(School).count()
    total_sessions = db.query(SessionModel).count()
    total_students = db.query(Student).count()
    reports_generated = db.query(Student).filter(
        Student.report_status.in_(["report_generated", "qa_passed", "qa_flagged", "pdf_ready", "delivered"])
    ).count()
    pdfs_ready = db.query(Student).filter(
        Student.report_status.in_(["pdf_ready", "delivered"])
    ).count()
    delivered = db.query(Student).filter(Student.delivery_status == "delivered").count()
    total_cost = db.query(func.sum(Student.llm_cost)).scalar() or 0.0

    return {
        "total_schools": total_schools,
        "total_sessions": total_sessions,
        "total_students": total_students,
        "reports_generated": reports_generated,
        "pdfs_ready": pdfs_ready,
        "delivered": delivered,
        "total_cost_usd": round(total_cost, 4),
    }


@router.get("/recent")
def get_recent_sessions(limit: int = 10, db: Session = Depends(get_db)):
    if limit > 100:
        limit = 100
    sessions = (
        db.query(SessionModel)
        .order_by(SessionModel.created_at.desc())
        .limit(limit)
        .all()
    )
    result = []
    for s in sessions:
        school = db.query(School).filter(School.id == s.school_id).first()
        student_count = db.query(Student).filter(Student.session_id == s.id).count()
        result.append({
            "id": s.id,
            "school_name": school.name if school else "",
            "school_city": school.city if school else "",
            "session_date": s.session_date.isoformat() if s.session_date else "",
            "classes_assessed": s.classes_assessed,
            "total_students": student_count,
            "status": s.status,
            "total_cost": s.total_cost,
            "created_at": s.created_at.isoformat() if s.created_at else "",
        })
    return result


@router.get("/aggregate")
def get_aggregate(db: Session = Depends(get_db)):
    """Aggregate stats for the founder's sales pitch deck.

    Returns live numbers: total students, recommendation accuracy, avg NPS,
    top 5 careers by city — all derived from real production data.
    """
    total_students = db.query(Student).count()
    total_schools = db.query(School).filter(School.code != "D2C-ONLINE").count()
    total_sessions = db.query(SessionModel).count()
    delivered = db.query(Student).filter(
        Student.delivery_status.in_(["sent", "delivered"])
    ).count()

    # Recommendation accuracy from StudentOutcome records
    outcomes = db.query(StudentOutcome).all()
    outcome_total = len(outcomes)
    matched = sum(1 for o in outcomes if o.recommendation_matched is True)
    accuracy_pct = round(matched / outcome_total * 100, 1) if outcome_total else None

    # NPS from Feedback (would_recommend True/False)
    feedbacks = db.query(Feedback).all()
    nps_total = len([f for f in feedbacks if f.would_recommend is not None])
    promoters = sum(1 for f in feedbacks if f.would_recommend is True)
    detractors = sum(1 for f in feedbacks if f.would_recommend is False)
    nps = round(((promoters - detractors) / nps_total) * 100) if nps_total else None

    ratings = [f.rating for f in feedbacks if f.rating is not None]
    avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else None

    # Top 5 careers by city (all schools, real data)
    city_career: dict[str, dict[str, int]] = {}
    students_with_careers = db.query(Student).filter(Student.matched_careers != None).all()  # noqa: E711
    for student in students_with_careers:
        session = db.query(SessionModel).filter(SessionModel.id == student.session_id).first()
        school = db.query(School).filter(School.id == session.school_id).first() if session else None
        city = school.city if school else "Unknown"
        for mc in (student.matched_careers or [])[:2]:
            name = mc.get("career_name", "")
            if name:
                city_career.setdefault(city, {})
                city_career[city][name] = city_career[city].get(name, 0) + 1

    top_careers_by_city = {
        city: sorted(careers.items(), key=lambda x: -x[1])[:5]
        for city, careers in city_career.items()
    }

    return {
        "total_students_assessed": total_students,
        "total_schools": total_schools,
        "total_sessions": total_sessions,
        "reports_delivered": delivered,
        "delivery_rate_pct": round(delivered / total_students * 100, 1) if total_students else 0,
        "recommendation_accuracy_pct": accuracy_pct,
        "outcomes_recorded": outcome_total,
        "nps": nps,
        "avg_rating": avg_rating,
        "feedback_responses": nps_total,
        "top_careers_by_city": {
            city: [{"career": c, "count": n} for c, n in careers]
            for city, careers in top_careers_by_city.items()
        },
    }


@router.get("/cost-summary")
def get_cost_summary(db: Session = Depends(get_db)):
    sessions = db.query(SessionModel).order_by(SessionModel.session_date.desc()).all()
    summary = []
    for s in sessions:
        school = db.query(School).filter(School.id == s.school_id).first()
        student_count = db.query(Student).filter(Student.session_id == s.id).count()
        summary.append({
            "session_id": s.id,
            "school_name": school.name if school else "",
            "session_date": s.session_date.isoformat() if s.session_date else "",
            "students": student_count,
            "total_cost": s.total_cost,
            "llm_provider": s.llm_provider,
            "cost_per_student": round(s.total_cost / student_count, 4) if student_count > 0 else 0,
        })
    return summary
