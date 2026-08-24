import secrets
import string
import logging
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timezone
from access import (
    AccessScope,
    get_scoped_session,
    get_scoped_student,
    require_role,
    resolve_scope,
    scoped_students,
)
from database import get_db
from utils.time import utcnow
from models import Student, Session as SessionModel

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(resolve_scope)])

# In-memory OTP store: phone -> {"otp": str, "student_id": int, "expires_at": float}
#
# IMPORTANT: this is process-local, so the API must run with a SINGLE worker.
# With more than one, an OTP issued by one worker is invisible to the others and
# verification fails for a fraction of parents at random. The Dockerfile does not
# pass --workers, so uvicorn's default of 1 holds; if that ever changes, move
# this to the database or Redis first.
_otp_store: dict = {}
_OTP_TTL = 600  # seconds


def _generate_otp() -> str:
    # secrets, not random: random is a predictable Mersenne Twister, and this is
    # the code standing between a caller and a parental consent record.
    return "".join(secrets.choice(string.digits) for _ in range(6))


def _purge_expired_otps() -> None:
    """Drop timed-out entries.

    Entries used to be removed only on successful verification, so every OTP
    that was requested and never confirmed stayed in memory for the lifetime of
    the process — an unbounded leak on a long-running server.
    """
    now = time.time()
    for phone in [p for p, e in _otp_store.items() if e.get("expires_at", 0) < now]:
        _otp_store.pop(phone, None)


# ── Pydantic models ────────────────────────────────────────────────────────────

class ConsentUpdate(BaseModel):
    student_ids: list[int]
    consent_method: str = "paper_form"
    consent_parent_name: str = ""


class OTPRequest(BaseModel):
    student_id: int
    parent_phone: str  # 10-digit Indian mobile number


class OTPVerify(BaseModel):
    student_id: int
    parent_phone: str
    otp: str
    consent_parent_name: str = ""


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/record-consent")
def record_consent(
    session_id: int,
    data: ConsentUpdate,
    db: Session = Depends(get_db),
    session: SessionModel = Depends(get_scoped_session),
):
    """Record parental consent for students in a session."""
    updated = 0
    for sid in data.student_ids:
        student = db.query(Student).filter(Student.id == sid, Student.session_id == session_id).first()
        if student:
            student.consent_obtained = True
            student.consent_timestamp = datetime.now(timezone.utc)
            student.consent_parent_name = data.consent_parent_name or student.parent_name
            student.consent_method = data.consent_method
            updated += 1
    db.commit()
    return {"message": f"Consent recorded for {updated} students", "updated": updated}


@router.post("/sessions/{session_id}/bulk-consent")
def bulk_consent(
    session_id: int,
    db: Session = Depends(get_db),
    session: SessionModel = Depends(get_scoped_session),
    _: object = Depends(require_role("admin", "counsellor")),
):
    """Mark all students in session as having paper-form consent (common for school sessions)."""
    students = db.query(Student).filter(Student.session_id == session_id).all()
    for s in students:
        s.consent_obtained = True
        s.consent_timestamp = utcnow()
        s.consent_method = "paper_form"
        if not s.consent_parent_name:
            s.consent_parent_name = s.parent_name
    db.commit()
    return {"message": f"Bulk consent recorded for {len(students)} students"}


@router.post("/send-otp")
async def send_consent_otp(req: OTPRequest, db: Session = Depends(get_db),
    scope: AccessScope = Depends(resolve_scope),
):
    """Send a 6-digit OTP via WhatsApp to the parent's phone for digital consent.

    The OTP expires in 10 minutes. Call /verify-otp to complete consent.
    """
    student = scoped_students(scope, db).filter(Student.id == req.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    otp = _generate_otp()
    expires_at = time.time() + _OTP_TTL
    _purge_expired_otps()
    _otp_store[req.parent_phone] = {"otp": otp, "student_id": req.student_id, "expires_at": expires_at}

    # Send via WhatsApp (falls back gracefully if not configured)
    try:
        from services.whatsapp import is_whatsapp_configured
        if is_whatsapp_configured():
            # Send text-only OTP message via WhatsApp
            from config import META_WHATSAPP_TOKEN, META_PHONE_NUMBER_ID, WHATSAPP_PROVIDER
            import httpx
            from services.whatsapp import normalize_phone
            phone = normalize_phone(req.parent_phone)
            if WHATSAPP_PROVIDER == "meta" and META_WHATSAPP_TOKEN and META_PHONE_NUMBER_ID:
                async with httpx.AsyncClient() as client:
                    await client.post(
                        f"https://graph.facebook.com/v18.0/{META_PHONE_NUMBER_ID}/messages",
                        headers={
                            "Authorization": f"Bearer {META_WHATSAPP_TOKEN}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "messaging_product": "whatsapp",
                            "to": phone,
                            "type": "text",
                            "text": {
                                "body": (
                                    f"CareerNeeti: Your OTP for consent to generate {student.name}'s "
                                    f"career report is *{otp}*. Valid for 10 minutes. "
                                    f"Do not share this with anyone."
                                )
                            },
                        },
                    )
                logger.info(f"OTP sent via WhatsApp to {req.parent_phone} for student {req.student_id}")
            else:
                logger.info(f"WhatsApp not configured — OTP for {req.parent_phone}: {otp} (dev mode)")
        else:
            logger.info(f"WhatsApp not configured — OTP for {req.parent_phone}: {otp} (dev mode)")
    except Exception as e:
        logger.warning(f"OTP WhatsApp send failed (OTP still valid in memory): {e}")

    return {"message": "OTP sent to parent's WhatsApp", "expires_in_seconds": _OTP_TTL}


@router.post("/verify-otp")
def verify_consent_otp(req: OTPVerify, db: Session = Depends(get_db),
    scope: AccessScope = Depends(resolve_scope),
):
    """Verify OTP and mark student consent as 'digital' (DPDPA-compliant)."""
    _purge_expired_otps()
    entry = _otp_store.get(req.parent_phone)
    if not entry:
        raise HTTPException(status_code=400, detail="No OTP found for this phone. Please request a new OTP.")
    if time.time() > entry["expires_at"]:
        del _otp_store[req.parent_phone]
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
    if entry["student_id"] != req.student_id:
        raise HTTPException(status_code=400, detail="OTP does not match the student.")
    if entry["otp"] != req.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP.")

    # OTP verified — record digital consent
    student = scoped_students(scope, db).filter(Student.id == req.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    student.consent_obtained = True
    student.consent_timestamp = datetime.now(timezone.utc)
    student.consent_method = "digital"
    student.consent_parent_name = req.consent_parent_name or student.parent_name
    db.commit()

    del _otp_store[req.parent_phone]  # consume OTP
    logger.info(f"Digital consent verified for student {req.student_id} via OTP")
    return {"message": "Consent recorded successfully", "consent_method": "digital"}


@router.delete("/students/{student_id}/data")
def delete_student_data(
    db: Session = Depends(get_db),
    student: Student = Depends(get_scoped_student),
    _: object = Depends(require_role("admin")),
):
    """Right to erasure: anonymise all personal data for a student (DPDPA Section 12)."""
    student.name = f"[REDACTED-{student.id}]"
    student.parent_name = ""
    student.parent_phone = ""
    student.riasec_raw_responses = {}
    student.report_content = {}
    student.consent_obtained = False
    student.consent_parent_name = ""
    # Keep: riasec_scores, holland_code, matched_careers for anonymised analytics
    db.commit()
    return {"message": "Student personal data deleted (anonymised)"}


@router.get("/sessions/{session_id}/consent-status")
def consent_status(
    session_id: int,
    db: Session = Depends(get_db),
    session: SessionModel = Depends(get_scoped_session),
):
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
