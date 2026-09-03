"""Public token-gated web report endpoint — resolves both D2C and school student tokens."""

import logging
from fastapi import APIRouter, HTTPException
from database import SessionLocal
from models import Student, D2CAssessment

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{token}")
def get_report_by_token(token: str):
    """Resolve a report token to report JSON. Works for both D2C and school students.

    D2C tokens: 64-char hex stored in d2c_assessments.token
    School tokens: 32-char hex stored in students.report_token
    """
    db = SessionLocal()
    try:
        # Try D2C token first
        assessment = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()
        if assessment:
            # Same gate as the D2C router's own report routes — imported rather
            # than repeated so the two cannot disagree about what "unlocked"
            # means. The school branch below has no payment gate at all: the
            # school pays, not the student.
            from routers.d2c import assert_report_is_deliverable

            if not assessment.student_id:
                raise HTTPException(status_code=400, detail="Report not yet generated")
            student = db.query(Student).filter(Student.id == assessment.student_id).first()
            assert_report_is_deliverable(assessment, student)
            if not student or not student.report_content:
                raise HTTPException(status_code=404, detail="Report not ready yet")
            return _student_report_response(token, student)

        # Try school student token
        student = db.query(Student).filter(Student.report_token == token).first()
        if student:
            if not student.report_content:
                raise HTTPException(status_code=404, detail="Report not ready yet")
            return _student_report_response(token, student)

        raise HTTPException(status_code=404, detail="Report not found")
    finally:
        db.close()


def _student_report_response(token: str, student: Student) -> dict:
    return {
        "token": token,
        "student_name": student.name,
        "class_level": student.class_level,
        "holland_code": student.holland_code,
        "riasec_scores": student.riasec_scores or {},
        "report": student.report_content or {},
    }
