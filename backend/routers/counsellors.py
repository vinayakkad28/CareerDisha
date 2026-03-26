"""Counsellor partner onboarding — school assignments and commission tracking."""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

from database import get_db
from models import SchoolAssignment, CounsellorCommission, User, School, Session as SessionModel, Student
from routers.auth import get_current_user
from permissions import require_role

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_user)])

PRICE_PER_STUDENT_INR = 500   # school session rate
DEFAULT_COMMISSION_RATE = 0.40  # 40%


# ── Schemas ──────────────────────────────────────────────────────────────────

class AssignRequest(BaseModel):
    counsellor_id: int
    school_id: int
    commission_rate: float = DEFAULT_COMMISSION_RATE
    notes: str = ""


class CommissionMarkPaid(BaseModel):
    notes: str = ""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _counsellor_row(u: User) -> dict:
    return {"id": u.id, "name": u.name, "email": u.email, "school_id": u.school_id, "is_active": u.is_active}


def _assignment_row(a: SchoolAssignment, db: Session) -> dict:
    counsellor = db.query(User).filter(User.id == a.counsellor_id).first()
    school = db.query(School).filter(School.id == a.school_id).first()
    return {
        "id": a.id,
        "counsellor_id": a.counsellor_id,
        "counsellor_name": counsellor.name if counsellor else "",
        "counsellor_email": counsellor.email if counsellor else "",
        "school_id": a.school_id,
        "school_name": school.name if school else "",
        "commission_rate": a.commission_rate,
        "is_active": a.is_active,
        "notes": a.notes,
        "created_at": a.created_at.isoformat() if a.created_at else "",
    }


def _commission_row(c: CounsellorCommission, db: Session) -> dict:
    counsellor = db.query(User).filter(User.id == c.counsellor_id).first()
    session = db.query(SessionModel).filter(SessionModel.id == c.session_id).first()
    school = db.query(School).filter(School.id == session.school_id).first() if session else None
    return {
        "id": c.id,
        "counsellor_id": c.counsellor_id,
        "counsellor_name": counsellor.name if counsellor else "",
        "session_id": c.session_id,
        "session_date": session.session_date.isoformat() if session and session.session_date else "",
        "school_name": school.name if school else "",
        "students_count": c.students_count,
        "rate_per_student": c.rate_per_student,
        "amount_inr": c.amount_inr,
        "status": c.status,
        "paid_at": c.paid_at.isoformat() if c.paid_at else None,
        "notes": c.notes,
    }


# ── Counsellor list ───────────────────────────────────────────────────────────

@router.get("/list")
def list_counsellors(db: Session = Depends(get_db), user: dict = Depends(require_role("admin"))):
    """List all counsellor accounts."""
    counsellors = db.query(User).filter(User.role == "counsellor").order_by(User.id).all()
    return [_counsellor_row(c) for c in counsellors]


# ── School assignments ────────────────────────────────────────────────────────

@router.get("/assignments")
def list_assignments(db: Session = Depends(get_db), user: dict = Depends(require_role("admin"))):
    """List all counsellor ↔ school assignments."""
    assignments = db.query(SchoolAssignment).order_by(SchoolAssignment.id).all()
    return [_assignment_row(a, db) for a in assignments]


@router.post("/assignments", status_code=201)
def create_assignment(req: AssignRequest, db: Session = Depends(get_db), user: dict = Depends(require_role("admin"))):
    """Assign a counsellor to a school."""
    if not (0 < req.commission_rate <= 1):
        raise HTTPException(status_code=400, detail="commission_rate must be between 0 and 1")
    counsellor = db.query(User).filter(User.id == req.counsellor_id, User.role == "counsellor").first()
    if not counsellor:
        raise HTTPException(status_code=404, detail="Counsellor not found")
    school = db.query(School).filter(School.id == req.school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    # Deactivate any existing assignment for same pair
    existing = db.query(SchoolAssignment).filter(
        SchoolAssignment.counsellor_id == req.counsellor_id,
        SchoolAssignment.school_id == req.school_id,
    ).first()
    if existing:
        existing.is_active = True
        existing.commission_rate = req.commission_rate
        existing.notes = req.notes
        db.commit()
        logger.info(f"Reactivated assignment: counsellor {req.counsellor_id} → school {req.school_id}")
        return _assignment_row(existing, db)

    a = SchoolAssignment(
        counsellor_id=req.counsellor_id,
        school_id=req.school_id,
        commission_rate=req.commission_rate,
        notes=req.notes,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    logger.info(f"Created assignment: counsellor {req.counsellor_id} → school {req.school_id}")
    return _assignment_row(a, db)


@router.delete("/assignments/{assignment_id}")
def remove_assignment(assignment_id: int, db: Session = Depends(get_db), user: dict = Depends(require_role("admin"))):
    """Deactivate a counsellor-school assignment."""
    a = db.query(SchoolAssignment).filter(SchoolAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    a.is_active = False
    db.commit()
    return {"message": "Assignment deactivated"}


@router.get("/my-schools")
def my_schools(db: Session = Depends(get_db), user: dict = Depends(require_role("counsellor", "admin"))):
    """Schools assigned to the current counsellor."""
    counsellor_id = user.get("user_id")
    assignments = db.query(SchoolAssignment).filter(
        SchoolAssignment.counsellor_id == counsellor_id,
        SchoolAssignment.is_active == True,
    ).all()
    result = []
    for a in assignments:
        school = db.query(School).filter(School.id == a.school_id).first()
        if school:
            result.append({
                "assignment_id": a.id,
                "school_id": school.id,
                "school_name": school.name,
                "school_city": school.city,
                "commission_rate": a.commission_rate,
            })
    return result


# ── Commission tracking ───────────────────────────────────────────────────────

@router.post("/commissions/{session_id}/calculate", status_code=201)
def calculate_commission(session_id: int, db: Session = Depends(get_db), user: dict = Depends(require_role("admin"))):
    """Calculate and record commission for a completed session.
    Looks up the assigned counsellor via school_assignments.
    """
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Find active assignment for this school
    assignment = db.query(SchoolAssignment).filter(
        SchoolAssignment.school_id == session.school_id,
        SchoolAssignment.is_active == True,
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="No active counsellor assigned to this school")

    # Count students with delivered/sent reports
    students_count = db.query(Student).filter(
        Student.session_id == session_id,
        Student.delivery_status.in_(["sent", "delivered"]),
    ).count()

    if students_count == 0:
        raise HTTPException(status_code=400, detail="No delivered students in this session yet")

    # Idempotent — update if exists
    existing = db.query(CounsellorCommission).filter(
        CounsellorCommission.counsellor_id == assignment.counsellor_id,
        CounsellorCommission.session_id == session_id,
    ).first()

    rate_per_student = round(PRICE_PER_STUDENT_INR * assignment.commission_rate)
    amount_inr = students_count * rate_per_student

    if existing:
        existing.students_count = students_count
        existing.rate_per_student = rate_per_student
        existing.amount_inr = amount_inr
        db.commit()
        return _commission_row(existing, db)

    c = CounsellorCommission(
        counsellor_id=assignment.counsellor_id,
        session_id=session_id,
        students_count=students_count,
        rate_per_student=rate_per_student,
        amount_inr=amount_inr,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    logger.info(f"Commission calculated: counsellor {assignment.counsellor_id}, session {session_id}, ₹{amount_inr}")
    return _commission_row(c, db)


@router.get("/commissions")
def list_commissions(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("admin")),
):
    """List all commissions (admin). Filter by status=pending|paid."""
    q = db.query(CounsellorCommission)
    if status:
        q = q.filter(CounsellorCommission.status == status)
    commissions = q.order_by(CounsellorCommission.id.desc()).all()
    return [_commission_row(c, db) for c in commissions]


@router.get("/my-commissions")
def my_commissions(db: Session = Depends(get_db), user: dict = Depends(require_role("counsellor", "admin"))):
    """Commission summary for the current counsellor."""
    counsellor_id = user.get("user_id")
    commissions = db.query(CounsellorCommission).filter(
        CounsellorCommission.counsellor_id == counsellor_id,
    ).order_by(CounsellorCommission.id.desc()).all()

    rows = [_commission_row(c, db) for c in commissions]
    total_pending = sum(r["amount_inr"] for r in rows if r["status"] == "pending")
    total_paid = sum(r["amount_inr"] for r in rows if r["status"] == "paid")
    return {
        "commissions": rows,
        "total_pending_inr": total_pending,
        "total_paid_inr": total_paid,
        "total_students": sum(r["students_count"] for r in rows),
    }


@router.post("/commissions/{commission_id}/mark-paid")
def mark_commission_paid(
    commission_id: int,
    req: CommissionMarkPaid,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("admin")),
):
    """Mark a commission as paid."""
    c = db.query(CounsellorCommission).filter(CounsellorCommission.id == commission_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Commission not found")
    if c.status == "paid":
        raise HTTPException(status_code=400, detail="Already marked as paid")
    c.status = "paid"
    c.paid_at = datetime.now(timezone.utc)
    c.notes = req.notes
    db.commit()
    logger.info(f"Commission {commission_id} marked paid (counsellor {c.counsellor_id}, ₹{c.amount_inr})")
    return _commission_row(c, db)
