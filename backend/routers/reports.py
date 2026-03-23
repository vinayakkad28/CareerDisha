from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import Student, Session as SessionModel
from routers.auth import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/sessions/{session_id}/qa-report")
def get_qa_report(session_id: int, db: Session = Depends(get_db)):
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    students = db.query(Student).filter(Student.session_id == session_id).all()
    passed = [s for s in students if s.report_status == "qa_passed"]
    flagged = [s for s in students if s.report_status == "qa_flagged"]

    flagged_details = []
    for s in flagged:
        flagged_details.append({
            "student_id": s.id,
            "name": s.name,
            "class_level": s.class_level,
            "flags": s.qa_flags or [],
        })

    return {
        "session_id": session_id,
        "total": len(students),
        "passed": len(passed),
        "flagged": len(flagged),
        "pending": len(students) - len(passed) - len(flagged),
        "flagged_details": flagged_details,
    }


class QAApproval(BaseModel):
    student_ids: list[int]


@router.post("/sessions/{session_id}/qa-approve")
def approve_flagged(session_id: int, approval: QAApproval, db: Session = Depends(get_db)):
    updated = 0
    for sid in approval.student_ids:
        student = db.query(Student).filter(Student.id == sid, Student.session_id == session_id).first()
        if student and student.report_status == "qa_flagged":
            student.report_status = "qa_passed"
            student.qa_flags = []
            updated += 1
    db.commit()
    return {"message": f"Approved {updated} reports", "updated": updated}


@router.get("/sessions/{session_id}/delivery-checklist")
def delivery_checklist(session_id: int, db: Session = Depends(get_db)):
    students = db.query(Student).filter(
        Student.session_id == session_id,
        Student.pdf_path != "",
    ).order_by(Student.class_level, Student.name).all()

    checklist = []
    for s in students:
        checklist.append({
            "student_id": s.id,
            "name": s.name,
            "class_level": s.class_level,
            "parent_name": s.parent_name,
            "parent_phone": s.parent_phone,
            "pdf_path": s.pdf_path,
            "delivery_status": s.delivery_status,
            "delivery_timestamp": s.delivery_timestamp,
        })

    return {
        "session_id": session_id,
        "total": len(checklist),
        "delivered": sum(1 for c in checklist if c["delivery_status"] == "delivered"),
        "pending": sum(1 for c in checklist if c["delivery_status"] == "pending"),
        "checklist": checklist,
    }
