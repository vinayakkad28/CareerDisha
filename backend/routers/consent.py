from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from database import get_db
from models import Student, Session as SessionModel
from routers.auth import get_current_user
from permissions import require_role

router = APIRouter(dependencies=[Depends(get_current_user)])


class ConsentUpdate(BaseModel):
    student_ids: list[int]
    consent_method: str = "paper_form"
    consent_parent_name: str = ""


@router.post("/sessions/{session_id}/record-consent")
def record_consent(session_id: int, data: ConsentUpdate, db: Session = Depends(get_db)):
    """Record parental consent for students in a session."""
    updated = 0
    for sid in data.student_ids:
        student = db.query(Student).filter(Student.id == sid, Student.session_id == session_id).first()
        if student:
            student.consent_obtained = True
            student.consent_timestamp = datetime.utcnow()
            student.consent_parent_name = data.consent_parent_name or student.parent_name
            student.consent_method = data.consent_method
            updated += 1
    db.commit()
    return {"message": f"Consent recorded for {updated} students", "updated": updated}


@router.post("/sessions/{session_id}/bulk-consent")
def bulk_consent(session_id: int, db: Session = Depends(get_db), user: dict = Depends(require_role("admin", "counsellor"))):
    """Mark all students in session as having paper-form consent (common for school sessions)."""
    students = db.query(Student).filter(Student.session_id == session_id).all()
    for s in students:
        s.consent_obtained = True
        s.consent_timestamp = datetime.utcnow()
        s.consent_method = "paper_form"
        if not s.consent_parent_name:
            s.consent_parent_name = s.parent_name
    db.commit()
    return {"message": f"Bulk consent recorded for {len(students)} students"}


@router.delete("/students/{student_id}/data")
def delete_student_data(student_id: int, db: Session = Depends(get_db)):
    """Right to erasure: delete all personal data for a student (DPDPA Section 12)."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    # Anonymize rather than hard delete to preserve aggregate stats
    student.name = f"[REDACTED-{student.id}]"
    student.parent_name = ""
    student.parent_phone = ""
    student.riasec_raw_responses = {}
    student.report_content = {}
    student.consent_obtained = False
    student.consent_parent_name = ""
    # Keep: riasec_scores, holland_code, matched_careers for anonymized analytics
    db.commit()
    return {"message": "Student personal data deleted (anonymized)"}


@router.get("/sessions/{session_id}/consent-status")
def consent_status(session_id: int, db: Session = Depends(get_db)):
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
