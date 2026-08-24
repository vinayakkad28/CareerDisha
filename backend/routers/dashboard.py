from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from access import AccessScope, require_role, resolve_scope, scoped_sessions, scoped_students
from database import get_db
from models import School, Session as SessionModel, Student, StudentOutcome, Feedback

router = APIRouter(dependencies=[Depends(resolve_scope)])


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    scope: AccessScope = Depends(resolve_scope),
):
    """Headline counts for the caller's own schools.

    These were platform-wide totals for every authenticated user, so a
    school_admin saw the count of every student in the system rather than their
    own. Admin still sees everything, because their scope is unrestricted.
    """
    sessions_q = scoped_sessions(scope, db)
    students_q = scoped_students(scope, db)

    session_ids = [row.id for row in sessions_q.with_entities(SessionModel.id).all()]
    school_ids = (
        {row.school_id for row in sessions_q.with_entities(SessionModel.school_id).all()}
        if not scope.is_superuser
        else None
    )

    total_schools = (
        db.query(School).count() if scope.is_superuser else len(school_ids or set())
    )
    total_sessions = len(session_ids)
    total_students = students_q.count()
    reports_generated = students_q.filter(
        Student.report_status.in_(["report_generated", "qa_passed", "qa_flagged", "pdf_ready", "delivered"])
    ).count()
    pdfs_ready = students_q.filter(
        Student.report_status.in_(["pdf_ready", "delivered"])
    ).count()
    delivered = students_q.filter(Student.delivery_status == "delivered").count()
    total_cost = (
        students_q.with_entities(func.coalesce(func.sum(Student.llm_cost), 0.0)).scalar() or 0.0
    )

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
def get_recent_sessions(
    limit: int = 10,
    db: Session = Depends(get_db),
    scope: AccessScope = Depends(resolve_scope),
):
    if limit > 100:
        limit = 100
    sessions = (
        scoped_sessions(scope, db)
        .order_by(SessionModel.created_at.desc())
        .limit(limit)
        .all()
    )

    # One query each for schools and counts, not two per row.
    school_ids = {se.school_id for se in sessions}
    schools_by_id = {
        sc.id: sc for sc in db.query(School).filter(School.id.in_(school_ids))
    } if school_ids else {}
    counts = dict(
        db.query(Student.session_id, func.count(Student.id))
        .filter(Student.session_id.in_([se.id for se in sessions] or [0]))
        .group_by(Student.session_id)
        .all()
    )

    result = []
    for s in sessions:
        school = schools_by_id.get(s.school_id)
        student_count = counts.get(s.id, 0)
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
def get_aggregate(
    db: Session = Depends(get_db),
    _: AccessScope = Depends(require_role("admin")),
):
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

    # Resolve session -> school -> city in two queries instead of two per
    # student. This loop previously issued 400-1000 round trips for a few
    # hundred students, on an endpoint whose own docstring calls it the
    # founder's pitch-deck source.
    session_ids = {st.session_id for st in students_with_careers}
    sessions_by_id = {
        se.id: se for se in db.query(SessionModel).filter(SessionModel.id.in_(session_ids))
    } if session_ids else {}
    school_ids = {se.school_id for se in sessions_by_id.values()}
    cities_by_school = {
        sc.id: sc.city for sc in db.query(School).filter(School.id.in_(school_ids))
    } if school_ids else {}

    for student in students_with_careers:
        session = sessions_by_id.get(student.session_id)
        city = cities_by_school.get(session.school_id, "Unknown") if session else "Unknown"
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
def get_cost_summary(
    db: Session = Depends(get_db),
    scope: AccessScope = Depends(resolve_scope),
):
    sessions = scoped_sessions(scope, db).order_by(SessionModel.session_date.desc()).all()

    # One query each for schools and per-session counts, rather than two per row.
    school_ids = {se.school_id for se in sessions}
    schools_by_id = {
        sc.id: sc for sc in db.query(School).filter(School.id.in_(school_ids))
    } if school_ids else {}
    counts = dict(
        db.query(Student.session_id, func.count(Student.id))
        .filter(Student.session_id.in_([se.id for se in sessions] or [0]))
        .group_by(Student.session_id)
        .all()
    )

    summary = []
    for s in sessions:
        school = schools_by_id.get(s.school_id)
        student_count = counts.get(s.id, 0)
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
