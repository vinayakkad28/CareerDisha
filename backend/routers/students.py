import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from access import AccessScope, get_scoped_student, require_role, resolve_scope
from database import get_db
from models import Student
from schemas.students import StudentDetail
from utils.time import utcnow

logger = logging.getLogger(__name__)

# resolve_scope replaces get_current_user at the router level: it authenticates
# AND rejects tokens that cannot be scoped, before any handler body runs.
router = APIRouter(dependencies=[Depends(resolve_scope)])


class DeliveryUpdate(BaseModel):
    delivery_status: str  # pending, sent, delivered, failed


def _detail(student: Student) -> StudentDetail:
    data = StudentDetail.model_validate(student)
    data.pdf_available = bool(student.pdf_path and Path(student.pdf_path).exists())
    return data


@router.get("/{student_id}", response_model=StudentDetail)
def get_student(student: Student = Depends(get_scoped_student)):
    """Return one student, limited to the fields the UI actually uses.

    get_scoped_student resolves the row through the caller's schools, so a
    counsellor for another school gets 404 rather than another school's PII.
    """
    return _detail(student)


@router.get("/{student_id}/pdf")
def download_pdf(
    student: Student = Depends(get_scoped_student),
    db: Session = Depends(get_db),
):
    # Rebuild rather than 404. OUTPUT_DIR is ephemeral on the hosted plan, so a
    # stored pdf_path routinely outlives the file it names — and nothing else in
    # the school pipeline can regenerate one, because run_pdf_generation only
    # picks up rows still in "qa_passed".
    from engines.pdf_generator import ensure_student_pdf

    try:
        path = ensure_student_pdf(student, db)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF not generated yet")
    except Exception as e:
        logger.error(f"PDF rebuild failed for student {student.id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=503, detail="Could not rebuild the report right now."
        )

    return FileResponse(
        str(path),
        media_type="application/pdf",
        filename=f"{student.name.replace(' ', '_')}_career_report.pdf",
    )


@router.post("/{student_id}/regenerate")
def regenerate_report(
    student: Student = Depends(get_scoped_student),
    _: AccessScope = Depends(require_role("admin", "counsellor")),
):
    """Regenerate a report. Costs an LLM call, so it is not open to every role."""
    from engines.report_generator import generate_single_report
    from engines.scoring_engine import load_knowledge_base

    kb = load_knowledge_base()
    generate_single_report(student, kb)
    return {"message": "Report regenerated", "student_id": student.id}


@router.put("/{student_id}/delivery")
def update_delivery(
    update: DeliveryUpdate,
    student: Student = Depends(get_scoped_student),
    db: Session = Depends(get_db),
):
    student.delivery_status = update.delivery_status
    if update.delivery_status == "delivered":
        student.delivery_timestamp = utcnow()
    db.commit()
    return {"message": "Delivery status updated", "delivery_status": update.delivery_status}
