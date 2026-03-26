"""WhatsApp delivery endpoints."""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from database import get_db
from models import Student, Session as SessionModel, School
from routers.auth import get_current_user
from services.whatsapp import send_pdf, send_bulk, send_survey_message, is_whatsapp_configured

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/status")
def whatsapp_status():
    """Check if WhatsApp is configured."""
    return {"configured": is_whatsapp_configured()}


@router.post("/send/{student_id}")
async def send_to_student(student_id: int, db: Session = Depends(get_db)):
    """Send PDF report to a single student's parent via WhatsApp."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if not student.pdf_path:
        raise HTTPException(status_code=400, detail="PDF not generated yet")
    if not student.parent_phone:
        raise HTTPException(status_code=400, detail="No parent phone number")

    session = db.query(SessionModel).filter(SessionModel.id == student.session_id).first()
    school = db.query(School).filter(School.id == session.school_id).first() if session else None
    school_name = school.name if school else "School"

    result = await send_pdf(student.parent_phone, student.pdf_path, student.name, school_name)

    if result["success"]:
        student.delivery_status = "sent"
        student.delivery_timestamp = datetime.now(timezone.utc)
        db.commit()
        logger.info(f"WhatsApp sent to {student.parent_phone} for {student.name}")
    else:
        student.delivery_status = "failed"
        db.commit()
        logger.error(f"WhatsApp failed for {student.name}: {result.get('error')}")

    return result


@router.post("/send-bulk/{session_id}")
async def send_bulk_session(session_id: int, db: Session = Depends(get_db)):
    """Send PDF reports to all students in a session via WhatsApp."""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    school = db.query(School).filter(School.id == session.school_id).first()
    school_name = school.name if school else "School"

    students = db.query(Student).filter(
        Student.session_id == session_id,
        Student.pdf_path != "",
        Student.parent_phone != "",
        Student.delivery_status != "delivered",
    ).all()

    if not students:
        raise HTTPException(status_code=404, detail="No students ready for delivery")

    students_data = [
        {"phone": s.parent_phone, "pdf_path": s.pdf_path, "name": s.name, "id": s.id}
        for s in students
    ]

    result = await send_bulk(students_data, school_name)

    # Update delivery statuses
    for s in students:
        if any(e["student"] == s.name for e in result.get("errors", [])):
            s.delivery_status = "failed"
        else:
            s.delivery_status = "sent"
            s.delivery_timestamp = datetime.now(timezone.utc)
    db.commit()

    return result


@router.post("/survey/{session_id}")
async def send_survey(session_id: int, db: Session = Depends(get_db)):
    """Send post-delivery satisfaction survey to parents delivered 48+ hours ago."""
    from datetime import timedelta
    import os

    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    students = db.query(Student).filter(
        Student.session_id == session_id,
        Student.delivery_status == "sent",
        Student.delivery_timestamp <= cutoff,
        Student.parent_phone != "",
    ).all()

    if not students:
        return {"message": "No eligible students (none delivered 48+ hours ago)", "sent": 0}

    base_url = os.getenv("APP_BASE_URL", "https://careerdisha.in")
    sent = 0
    failed = 0
    for student in students:
        feedback_url = f"{base_url}/feedback?sid={student.id}"
        result = await send_survey_message(student.parent_phone, student.name, feedback_url)
        if result["success"]:
            sent += 1
        else:
            failed += 1
            logger.warning(f"Survey send failed for {student.name}: {result.get('error')}")

    return {"sent": sent, "failed": failed, "total": len(students)}
