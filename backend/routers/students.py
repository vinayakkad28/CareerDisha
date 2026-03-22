from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from pathlib import Path

from database import get_db
from models import Student

router = APIRouter()


class DeliveryUpdate(BaseModel):
    delivery_status: str  # pending, sent, delivered, failed


@router.get("/{student_id}")
def get_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return {c.name: getattr(student, c.name) for c in student.__table__.columns}


@router.get("/{student_id}/pdf")
def download_pdf(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if not student.pdf_path or not Path(student.pdf_path).exists():
        raise HTTPException(status_code=404, detail="PDF not generated yet")
    return FileResponse(
        student.pdf_path,
        media_type="application/pdf",
        filename=f"{student.name.replace(' ', '_')}_career_report.pdf",
    )


@router.post("/{student_id}/regenerate")
def regenerate_report(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    from engines.report_generator import generate_single_report
    from engines.scoring_engine import load_knowledge_base
    kb = load_knowledge_base()
    result = generate_single_report(student, kb)
    return {"message": "Report regenerated", "student_id": student_id}


@router.put("/{student_id}/delivery")
def update_delivery(student_id: int, update: DeliveryUpdate, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student.delivery_status = update.delivery_status
    if update.delivery_status == "delivered":
        student.delivery_timestamp = datetime.utcnow()
    db.commit()
    return {"message": "Delivery status updated", "delivery_status": update.delivery_status}
