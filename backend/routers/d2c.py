import uuid
import logging
from datetime import datetime, date
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from database import get_db, SessionLocal
from models import Lead, D2CAssessment, Student, School, Session
from engines.scoring_engine import calculate_riasec_scores, determine_holland_code, match_careers, load_knowledge_base
from rate_limit import limiter

logger = logging.getLogger(__name__)
router = APIRouter()

D2C_PRICING = {
    "basic": 499,
    "plus": 1999,
    "premium": 2999,
}

D2C_SCHOOL_CODE = "D2C-ONLINE"


def get_or_create_d2c_session(db):
    """Get or create the D2C virtual school and a monthly session."""
    school = db.query(School).filter(School.code == D2C_SCHOOL_CODE).first()
    if not school:
        school = School(name="CareerDisha Online", code=D2C_SCHOOL_CODE, city="Online", board="All")
        db.add(school)
        db.flush()

    today = date.today()
    first_of_month = today.replace(day=1)
    session = db.query(Session).filter(
        Session.school_id == school.id,
        Session.session_date == first_of_month,
    ).first()
    if not session:
        session = Session(
            school_id=school.id,
            session_date=first_of_month,
            classes_assessed=[9, 10, 11, 12],
            counsellor_name="CareerDisha AI",
            status="scored",
            llm_provider="groq",
        )
        db.add(session)
        db.flush()
    return session


class StartRequest(BaseModel):
    lead_id: Optional[int] = None

class SubmitRequest(BaseModel):
    student_name: str
    student_email: str = ""
    parent_phone: str = ""
    class_level: int
    answers: dict  # {"Q1": "D", "Q2": "A", ...} or {"Q1": 4, "Q2": 1, ...}
    gender: str = ""
    family_income: str = ""
    location_type: str = ""
    parental_education: str = ""
    first_gen_learner: bool = False
    self_efficacy: Optional[dict] = None
    academic_marks: Optional[dict] = None

class CreateOrderRequest(BaseModel):
    tier: str = "basic"


@router.post("/start")
@limiter.limit("30/minute")
def start_assessment(request: Request, body: StartRequest = StartRequest()):
    """Create a new D2C assessment. Returns a token for all subsequent calls."""
    token = uuid.uuid4().hex
    db = SessionLocal()
    try:
        assessment = D2CAssessment(token=token, lead_id=body.lead_id)
        db.add(assessment)
        db.commit()
        db.refresh(assessment)
        return {"token": token, "assessment_id": assessment.id}
    finally:
        db.close()


@router.get("/questions")
def get_questions():
    """Return all 74 RIASEC questions + 6 self-efficacy items for online assessment."""
    import json
    from config import DATA_DIR

    # Try loading full questions file
    questions_path = DATA_DIR / "riasec_questions_full.json"
    if questions_path.exists():
        with open(questions_path) as f:
            return json.load(f)

    # Fallback: generate from item map + hardcoded texts
    from config import RIASEC_TYPE_NAMES
    item_map_path = DATA_DIR / "riasec_item_map.json"
    with open(item_map_path) as f:
        item_map = json.load(f)

    questions = []
    for q_key, dimension in item_map.items():
        q_num = int(q_key.replace("Q", ""))
        questions.append({
            "id": q_num,
            "key": q_key,
            "dimension": dimension,
            "dimension_name": RIASEC_TYPE_NAMES.get(dimension, "Work Values"),
        })

    self_efficacy_items = [
        {"id": "se_maths", "text": "I believe I can succeed in Mathematics", "text_hi": "मुझे विश्वास है कि मैं गणित में सफल हो सकता/सकती हूँ"},
        {"id": "se_science", "text": "I believe I can succeed in Science", "text_hi": "मुझे विश्वास है कि मैं विज्ञान में सफल हो सकता/सकती हूँ"},
        {"id": "se_english", "text": "I believe I can succeed in English", "text_hi": "मुझे विश्वास है कि मैं अंग्रेज़ी में सफल हो सकता/सकती हूँ"},
        {"id": "se_arts", "text": "I believe I can succeed in Creative Arts", "text_hi": "मुझे विश्वास है कि मैं रचनात्मक कला में सफल हो सकता/सकती हूँ"},
        {"id": "se_business", "text": "I believe I can succeed in Business/Commerce", "text_hi": "मुझे विश्वास है कि मैं व्यापार/वाणिज्य में सफल हो सकता/सकती हूँ"},
        {"id": "se_social", "text": "I believe I can succeed in Social Service", "text_hi": "मुझे विश्वास है कि मैं समाज सेवा में सफल हो सकता/सकती हूँ"},
    ]

    return {"riasec_questions": questions, "self_efficacy_items": self_efficacy_items, "total_riasec": len(questions)}


@router.post("/submit/{token}")
@limiter.limit("10/minute")
def submit_assessment(request: Request, token: str, body: SubmitRequest):
    """Submit student info + all 74 answers. Triggers RIASEC scoring."""
    db = SessionLocal()
    try:
        assessment = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        if assessment.status not in ("created", "info_collected"):
            raise HTTPException(status_code=400, detail=f"Assessment already submitted (status: {assessment.status})")

        if body.class_level not in (9, 10, 11, 12):
            raise HTTPException(status_code=400, detail="Class must be 9, 10, 11, or 12")

        # Normalize answers to Q1-Q74 format with A-E values
        normalized = {}
        likert_reverse = {1: "A", 2: "B", 3: "C", 4: "D", 5: "E"}
        for key, val in body.answers.items():
            q_key = key if key.startswith("Q") else f"Q{key}"
            if isinstance(val, int):
                normalized[q_key] = likert_reverse.get(val, "C")
            else:
                normalized[q_key] = str(val).upper()

        if len(normalized) < 60:
            raise HTTPException(status_code=400, detail=f"Need at least 60 answers, got {len(normalized)}")

        # Score the assessment
        result = calculate_riasec_scores(normalized)
        riasec_scores = result["riasec_scores"]
        work_values = result["work_values"]
        holland_code = determine_holland_code(riasec_scores)
        kb = load_knowledge_base()
        matched = match_careers(holland_code, kb, top_n=10)

        # Get or create D2C virtual session
        d2c_session = get_or_create_d2c_session(db)

        # Create Student record
        student = Student(
            session_id=d2c_session.id,
            student_id_external=f"D2C-{assessment.id}",
            name=body.student_name,
            class_level=body.class_level,
            parent_phone=body.parent_phone,
            gender=body.gender,
            family_income=body.family_income,
            location_type=body.location_type,
            parental_education=body.parental_education,
            first_gen_learner=body.first_gen_learner,
            self_efficacy=body.self_efficacy,
            academic_marks=body.academic_marks,
            riasec_raw_responses=normalized,
            riasec_scores=riasec_scores,
            holland_code=holland_code,
            work_values=work_values,
            matched_careers=matched,
            report_status="scored",
            consent_obtained=True,
            consent_method="digital",
            consent_timestamp=datetime.utcnow(),
            d2c_assessment_id=assessment.id,
        )
        db.add(student)
        db.flush()

        # Update assessment
        assessment.student_id = student.id
        assessment.student_name = body.student_name
        assessment.student_email = body.student_email
        assessment.parent_phone = body.parent_phone
        assessment.class_level = body.class_level
        assessment.raw_responses = normalized
        assessment.self_efficacy = body.self_efficacy
        assessment.gender = body.gender
        assessment.family_income = body.family_income
        assessment.location_type = body.location_type
        assessment.parental_education = body.parental_education
        assessment.first_gen_learner = body.first_gen_learner
        assessment.academic_marks = body.academic_marks
        assessment.status = "assessment_complete"

        # Update lead if linked
        if assessment.lead_id:
            lead = db.query(Lead).filter(Lead.id == assessment.lead_id).first()
            if lead:
                lead.converted = True

        db.commit()

        logger.info(f"D2C assessment {token}: scored for {body.student_name} (Class {body.class_level}, Holland: {holland_code})")
        return {"token": token, "status": "assessment_complete", "holland_code": holland_code}
    finally:
        db.close()


@router.get("/preview/{token}")
def preview_results(token: str):
    """Return teaser results — enough to motivate purchase, not enough for free."""
    db = SessionLocal()
    try:
        assessment = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        if not assessment.student_id:
            raise HTTPException(status_code=400, detail="Assessment not yet submitted")

        student = db.query(Student).filter(Student.id == assessment.student_id).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student record not found")

        # Teaser: scores + stream + 3 career NAMES only (no details)
        matched = student.matched_careers or []
        career_teasers = [{"name": m.get("career_name", ""), "match_type": m.get("match_type", "")} for m in matched[:3]]

        # Determine stream recommendation from Holland code
        primary = student.holland_code[0] if student.holland_code else ""
        stream_map = {"R": "Science (PCM)", "I": "Science (PCM)", "A": "Arts/Humanities", "S": "Science (PCB)", "E": "Commerce", "C": "Commerce"}
        stream = stream_map.get(primary, "Explore all options")

        return {
            "token": token,
            "student_name": student.name,
            "class_level": student.class_level,
            "holland_code": student.holland_code,
            "riasec_scores": student.riasec_scores,
            "recommended_stream": stream,
            "top_careers_preview": career_teasers,
            "total_careers_matched": len(matched),
            "report_locked": assessment.payment_status != "paid",
            "pricing": D2C_PRICING,
        }
    finally:
        db.close()


@router.post("/create-order/{token}")
@limiter.limit("10/minute")
def create_payment_order(request: Request, token: str, body: CreateOrderRequest):
    """Create a Razorpay order for payment."""
    db = SessionLocal()
    try:
        assessment = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        if assessment.payment_status == "paid":
            raise HTTPException(status_code=400, detail="Already paid")

        tier = body.tier
        if tier not in D2C_PRICING:
            raise HTTPException(status_code=400, detail=f"Invalid tier: {tier}. Options: {list(D2C_PRICING.keys())}")

        amount = D2C_PRICING[tier]
        assessment.tier = tier
        assessment.amount_inr = amount

        # Try Razorpay
        try:
            from services.razorpay_service import create_razorpay_order
            order = create_razorpay_order(amount * 100, f"d2c_{assessment.id}", {"token": token, "tier": tier})
            assessment.razorpay_order_id = order["id"]
            db.commit()
            return {
                "order_id": order["id"],
                "amount": amount,
                "currency": "INR",
                "tier": tier,
                "key_id": order.get("key_id", ""),
            }
        except Exception as e:
            logger.warning(f"Razorpay not configured, using mock payment: {e}")
            # Mock payment for development
            mock_order_id = f"mock_order_{uuid.uuid4().hex[:12]}"
            assessment.razorpay_order_id = mock_order_id
            db.commit()
            return {
                "order_id": mock_order_id,
                "amount": amount,
                "currency": "INR",
                "tier": tier,
                "mock": True,
                "message": "Razorpay not configured. Use POST /verify-payment with mock=true to simulate payment.",
            }
    finally:
        db.close()


@router.post("/verify-payment/{token}")
def verify_payment(token: str, razorpay_order_id: str = "", razorpay_payment_id: str = "", razorpay_signature: str = "", mock: bool = False):
    """Verify payment and trigger report generation."""
    from fastapi import BackgroundTasks

    db = SessionLocal()
    try:
        assessment = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        if assessment.payment_status == "paid":
            return {"status": "already_paid", "token": token}

        # Verify payment
        if mock or assessment.razorpay_order_id.startswith("mock_"):
            # Mock payment for development
            verified = True
        else:
            try:
                from services.razorpay_service import verify_razorpay_payment
                verified = verify_razorpay_payment(razorpay_order_id, razorpay_payment_id, razorpay_signature)
            except Exception:
                verified = False

        if not verified:
            raise HTTPException(status_code=400, detail="Payment verification failed")

        assessment.payment_status = "paid"
        assessment.razorpay_payment_id = razorpay_payment_id or "mock"
        assessment.paid_at = datetime.utcnow()
        assessment.status = "paid"
        db.commit()

        logger.info(f"D2C payment verified: {token} (tier={assessment.tier}, amount=₹{assessment.amount_inr})")

        # Trigger report generation in background
        # We can't use FastAPI BackgroundTasks here since we're not in a route handler with it injected
        # Instead, generate synchronously or use a thread
        import threading
        thread = threading.Thread(target=_generate_d2c_report, args=(assessment.id,))
        thread.start()

        return {"status": "paid", "token": token, "report_generating": True}
    finally:
        db.close()


def _generate_d2c_report(assessment_id: int):
    """Background: generate report, PDF, and deliver."""
    from engines.report_generator import generate_single_report
    from engines.pdf_generator import generate_student_pdf
    from engines.scoring_engine import load_knowledge_base
    from config import OUTPUT_DIR

    db = SessionLocal()
    try:
        assessment = db.query(D2CAssessment).filter(D2CAssessment.id == assessment_id).first()
        if not assessment or not assessment.student_id:
            return

        student = db.query(Student).filter(Student.id == assessment.student_id).first()
        if not student:
            return

        assessment.status = "report_generating"
        db.commit()

        # Generate LLM report
        kb = load_knowledge_base()
        try:
            cost = generate_single_report(student, kb, "groq", db)
            student.report_status = "report_generated"
            db.commit()
            logger.info(f"D2C report generated for assessment {assessment.token} (cost: ${cost:.4f})")
        except Exception as e:
            logger.error(f"D2C report generation failed for {assessment.token}: {e}")
            assessment.status = "assessment_complete"  # Allow retry
            db.commit()
            return

        # Skip QA for D2C (auto-pass) and generate PDF
        student.report_status = "qa_passed"
        db.commit()

        output_dir = OUTPUT_DIR / "d2c"
        output_dir.mkdir(parents=True, exist_ok=True)
        try:
            pdf_path = generate_student_pdf(student, output_dir, counsellor_name="CareerDisha AI")
            student.pdf_path = str(pdf_path)
            student.report_status = "pdf_ready"
            assessment.pdf_url = str(pdf_path)
            assessment.status = "report_ready"
            assessment.completed_at = datetime.utcnow()
            db.commit()
            logger.info(f"D2C PDF generated: {pdf_path}")
        except Exception as e:
            logger.error(f"D2C PDF generation failed: {e}")
            assessment.status = "report_generating"  # Allow retry
            db.commit()

        # TODO: Send email and WhatsApp delivery

    except Exception as e:
        logger.error(f"D2C report pipeline failed for assessment {assessment_id}: {e}", exc_info=True)
    finally:
        db.close()


@router.get("/status/{token}")
def check_status(token: str):
    """Check assessment and report generation status."""
    db = SessionLocal()
    try:
        assessment = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")

        return {
            "token": token,
            "status": assessment.status,
            "payment_status": assessment.payment_status,
            "report_ready": assessment.status == "report_ready",
            "pdf_available": bool(assessment.pdf_url),
        }
    finally:
        db.close()


@router.get("/report/{token}")
def get_report(token: str):
    """Get full report JSON (payment required)."""
    db = SessionLocal()
    try:
        assessment = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        if assessment.payment_status != "paid":
            raise HTTPException(status_code=402, detail="Payment required")
        if not assessment.student_id:
            raise HTTPException(status_code=400, detail="Report not yet generated")

        student = db.query(Student).filter(Student.id == assessment.student_id).first()
        if not student or not student.report_content:
            raise HTTPException(status_code=404, detail="Report not ready yet")

        return {
            "token": token,
            "student_name": student.name,
            "class_level": student.class_level,
            "holland_code": student.holland_code,
            "riasec_scores": student.riasec_scores,
            "report": student.report_content,
        }
    finally:
        db.close()


@router.get("/pdf/{token}")
def download_pdf(token: str):
    """Download PDF report (payment required)."""
    from fastapi.responses import FileResponse
    from pathlib import Path

    db = SessionLocal()
    try:
        assessment = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        if assessment.payment_status != "paid":
            raise HTTPException(status_code=402, detail="Payment required")
        if not assessment.pdf_url or not Path(assessment.pdf_url).exists():
            raise HTTPException(status_code=404, detail="PDF not ready yet")

        return FileResponse(
            assessment.pdf_url,
            media_type="application/pdf",
            filename=f"CareerDisha_Report_{assessment.student_name.replace(' ', '_')}.pdf",
        )
    finally:
        db.close()
