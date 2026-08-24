"""Share card generation endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from access import get_scoped_student, resolve_scope
from database import get_db
from models import Student

router = APIRouter(dependencies=[Depends(resolve_scope)])


@router.get("/{student_id}/share-card")
def get_share_card(student: Student = Depends(get_scoped_student)):
    """Generate and return a shareable PNG card for a student.

    The card renders the student's name and Holland profile, so it is scoped
    like any other student record — a counsellor from another school gets 404.
    """
    if not student.riasec_scores:
        raise HTTPException(status_code=400, detail="Student not yet scored")

    from engines.card_generator import generate_share_card
    png_bytes = generate_share_card(student)

    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Content-Disposition": f"inline; filename={student.name.replace(' ', '_')}_card.png"},
    )
