import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from access import AccessScope, get_scoped_student, require_role, resolve_scope
from database import get_db
from models import AuditLog, Student
from routers.counsellors import PRICE_PER_STUDENT_INR
from schemas.students import StudentDetail
from utils.time import utcnow

logger = logging.getLogger(__name__)

# resolve_scope replaces get_current_user at the router level: it authenticates
# AND rejects tokens that cannot be scoped, before any handler body runs.
router = APIRouter(dependencies=[Depends(resolve_scope)])


class DeliveryUpdate(BaseModel):
    delivery_status: str  # pending, sent, delivered, failed


# The fee is collected in person at the school; nothing is charged online. This
# records what was taken so a session reconciles and commission accrues on money
# received rather than on a PDF having been handed over.
PAYMENT_MODES = ("cash", "upi", "cheque", "school")


class FeeUpdate(BaseModel):
    fee_paid: bool
    fee_amount: int = PRICE_PER_STUDENT_INR
    payment_mode: str = ""
    collected_by: str = ""
    receipt_no: str = ""

    @field_validator("payment_mode")
    @classmethod
    def _known_mode(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if v and v not in PAYMENT_MODES:
            raise ValueError(f"payment_mode must be one of {', '.join(PAYMENT_MODES)}")
        return v

    @field_validator("fee_amount")
    @classmethod
    def _sane_amount(cls, v: int) -> int:
        if v < 0:
            raise ValueError("fee_amount cannot be negative")
        return v


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


@router.put("/{student_id}/fee")
def update_fee(
    update: FeeUpdate,
    student: Student = Depends(get_scoped_student),
    db: Session = Depends(get_db),
    # A school_admin sees their own students but must not write our revenue
    # record: it is what counsellor commission is computed from.
    scope: AccessScope = Depends(require_role("admin", "counsellor")),
):
    """Record — or reverse — an offline fee collection.

    Marking unpaid clears the whole record rather than leaving a stale receipt
    number and timestamp behind, because a reversal is normally a correction of
    the wrong student having been ticked.
    """
    student.fee_paid = update.fee_paid
    if update.fee_paid:
        student.fee_amount = update.fee_amount
        student.payment_mode = update.payment_mode
        student.collected_by = update.collected_by
        student.receipt_no = update.receipt_no
        student.fee_paid_at = utcnow()
        detail = f"paid Rs {update.fee_amount} via {update.payment_mode or 'unspecified'}"
    else:
        student.fee_amount = 0
        student.payment_mode = ""
        student.collected_by = ""
        student.receipt_no = ""
        student.fee_paid_at = None
        detail = "marked unpaid"

    db.add(AuditLog(
        user_id=scope.user_id or None,
        action="student_fee_updated",
        entity_type="student",
        entity_id=student.id,
        detail=detail,
    ))
    db.commit()
    return {
        "message": "Fee record updated",
        "fee_paid": student.fee_paid,
        "fee_amount": student.fee_amount,
    }
