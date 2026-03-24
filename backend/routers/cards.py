"""Share card generation endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from database import get_db
from models import Student
from routers.auth import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/{student_id}/share-card")
def get_share_card(student_id: int, db: Session = Depends(get_db)):
    """Generate and return a shareable PNG card for a student."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if not student.riasec_scores:
        raise HTTPException(status_code=400, detail="Student not yet scored")

    from engines.card_generator import generate_share_card
    png_bytes = generate_share_card(student)

    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Content-Disposition": f"inline; filename={student.name.replace(' ', '_')}_card.png"},
    )
