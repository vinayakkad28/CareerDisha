from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import School, Session as SessionModel, Student

router = APIRouter()


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
