import uuid
import logging
from datetime import datetime, date, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from database import get_db, SessionLocal
from models import Lead, D2CAssessment, Student, School, Session
from engines.scoring_engine import calculate_riasec_scores, determine_holland_code, match_careers, load_knowledge_base
from rate_limit import limiter
from config import ENABLE_PAYMENTS
from utils.self_efficacy import normalize_self_efficacy
from utils.time import utcnow

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
        school = School(name="CareerNeeti Online", code=D2C_SCHOOL_CODE, city="Online", board="All")
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
            counsellor_name="CareerNeeti AI",
            status="scored",
            llm_provider="groq",
        )
        db.add(session)
        db.flush()
    return session


class StartRequest(BaseModel):
    lead_id: Optional[int] = None
    student_name: str = ""
    student_email: str = ""
    parent_phone: str = ""
    class_level: int = 10

class ContextRequest(BaseModel):
    gender: str = ""
    income_bracket: str = ""
    location: str = ""
    parental_education: str = ""
    first_gen_learner: bool = False
    math_marks: Optional[int] = None
    science_marks: Optional[int] = None
    english_marks: Optional[int] = None
    social_studies_marks: Optional[int] = None
    strongest_subject: Optional[str] = None
    coaching_affordability: str = ""
    mobility_willingness: str = ""
    parent_primary_concern: str = ""
    family_career_role_model: str = ""

class SelfEfficacyRequest(BaseModel):
    scores: dict = {}

class SubmitRequest(BaseModel):
    student_name: str = ""   # falls back to value stored at /start
    student_email: str = ""
    parent_phone: str = ""
    class_level: int = 0     # 0 = falls back to value stored at /start
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


class VerifyPaymentRequest(BaseModel):
    """Razorpay handler payload.

    These were previously declared as bare `str` parameters on the route, which
    FastAPI binds as QUERY parameters — so the JSON body the client actually
    sent was ignored and the signature never reached verification.
    """
    razorpay_order_id: str = ""
    razorpay_payment_id: str = ""
    razorpay_signature: str = ""


@router.post("/start")
@limiter.limit("30/minute")
def start_assessment(request: Request, body: StartRequest = StartRequest()):
    """Create a new D2C assessment. Returns a token for all subsequent calls."""
    token = uuid.uuid4().hex
    db = SessionLocal()
    try:
        assessment = D2CAssessment(
            token=token,
            lead_id=body.lead_id,
            student_name=body.student_name,
            student_email=body.student_email,
            parent_phone=body.parent_phone,
            class_level=body.class_level,
        )
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


@router.post("/context/{token}")
def save_context(token: str, body: ContextRequest):
    """Save demographic context from Step 2. Non-critical — won't block flow if it fails."""
    db = SessionLocal()
    try:
        assessment = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        assessment.gender = body.gender
        assessment.family_income = body.income_bracket
        assessment.location_type = body.location
        assessment.parental_education = body.parental_education
        assessment.first_gen_learner = body.first_gen_learner
        if body.math_marks is not None or body.science_marks is not None or body.english_marks is not None:
            marks = {
                "math": body.math_marks,
                "science": body.science_marks,
                "english": body.english_marks,
            }
            if body.social_studies_marks is not None:
                marks["social_studies"] = body.social_studies_marks
            if body.strongest_subject:
                marks["strongest_subject"] = body.strongest_subject
            assessment.academic_marks = marks
        # Family context fields
        if body.coaching_affordability:
            assessment.coaching_affordability = body.coaching_affordability
        if body.mobility_willingness:
            assessment.mobility_willingness = body.mobility_willingness
        if body.parent_primary_concern:
            assessment.parent_primary_concern = body.parent_primary_concern
        if body.family_career_role_model:
            assessment.family_career_role_model = body.family_career_role_model
        if assessment.status == "created":
            assessment.status = "info_collected"
        db.commit()
        return {"status": "saved"}
    finally:
        db.close()


@router.post("/self-efficacy/{token}")
def save_self_efficacy(token: str, body: SelfEfficacyRequest):
    """Save self-efficacy scores from Step 3. Non-critical — won't block flow if it fails."""
    db = SessionLocal()
    try:
        assessment = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        # Normalise at the boundary so consumers can do a plain lookup.
        assessment.self_efficacy = normalize_self_efficacy(body.scores)
        db.commit()
        return {"status": "saved"}
    finally:
        db.close()


class AptitudeSubmitRequest(BaseModel):
    responses: dict = {}   # {"APT_N1": "B", "APT_V2": "A", ...}
    time_taken: int = 0    # seconds


@router.get("/aptitude-questions")
def get_aptitude_questions():
    """Return 15 aptitude questions (without correct answers)."""
    from engines.aptitude_scorer import get_questions_for_api
    return {"questions": get_questions_for_api(), "time_limit_seconds": 600}


@router.post("/aptitude/{token}")
def save_aptitude(token: str, body: AptitudeSubmitRequest):
    """Save and score aptitude test responses."""
    from engines.aptitude_scorer import score_aptitude
    db = SessionLocal()
    try:
        assessment = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        assessment.aptitude_raw_responses = body.responses
        assessment.aptitude_time_taken = body.time_taken
        assessment.aptitude_scores = score_aptitude(body.responses)
        db.commit()
        return {"status": "saved", "scores": assessment.aptitude_scores}
    finally:
        db.close()


class TIPIRequest(BaseModel):
    responses: dict = {}  # {"BF1": "D", "BF2": "B", ...}


class CareerReadinessRequest(BaseModel):
    responses: dict = {}  # {"CR1": "D", "CR2": "B", ...}


@router.get("/tipi-questions")
def get_tipi_questions():
    """Return 10 TIPI items (without scoring metadata)."""
    from engines.tipi_scorer import get_tipi_for_api
    return get_tipi_for_api()


@router.post("/tipi/{token}")
def save_tipi(token: str, body: TIPIRequest):
    """Score and save TIPI (Big Five personality) responses."""
    from engines.tipi_scorer import score_tipi
    db = SessionLocal()
    try:
        assessment = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        assessment.tipi_raw_responses = body.responses
        assessment.big_five_scores = score_tipi(body.responses)
        db.commit()
        return {"status": "saved", "scores": assessment.big_five_scores}
    finally:
        db.close()


@router.get("/career-readiness-questions")
def get_career_readiness_questions():
    """Return 5 career readiness items."""
    from engines.career_readiness_scorer import get_career_readiness_for_api
    return get_career_readiness_for_api()


@router.post("/career-readiness/{token}")
def save_career_readiness(token: str, body: CareerReadinessRequest):
    """Score and save career readiness responses."""
    from engines.career_readiness_scorer import score_career_readiness
    db = SessionLocal()
    try:
        assessment = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        cr_score, cr_level = score_career_readiness(body.responses)
        assessment.career_readiness_responses = body.responses
        assessment.career_readiness_score = cr_score
        assessment.career_readiness_level = cr_level
        db.commit()
        return {"status": "saved", "score": cr_score, "level": cr_level}
    finally:
        db.close()


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

        # Fall back to values stored at /start if not provided in submit body
        if not body.student_name:
            body.student_name = assessment.student_name or "Student"
        if not body.class_level:
            body.class_level = assessment.class_level or 10
        if not body.student_email:
            body.student_email = assessment.student_email or ""
        if not body.parent_phone:
            body.parent_phone = assessment.parent_phone or ""
        # Fall back to context saved at /context step
        if not body.gender and assessment.gender:
            body.gender = assessment.gender
        if not body.family_income and assessment.family_income:
            body.family_income = assessment.family_income
        if not body.location_type and assessment.location_type:
            body.location_type = assessment.location_type
        if not body.parental_education and assessment.parental_education:
            body.parental_education = assessment.parental_education
        if body.self_efficacy is None and assessment.self_efficacy:
            body.self_efficacy = assessment.self_efficacy
        body.self_efficacy = normalize_self_efficacy(body.self_efficacy)
        if body.academic_marks is None and assessment.academic_marks:
            body.academic_marks = assessment.academic_marks

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
            consent_timestamp=datetime.now(timezone.utc),
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
        assessment.self_efficacy = normalize_self_efficacy(body.self_efficacy)
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

        # Multi-dimensional stream recommendation
        from engines.stream_recommender import recommend_stream
        from engines.academic_scorer import calculate_academic_fit
        from engines.family_scorer import calculate_family_feasibility
        from engines.aptitude_scorer import calculate_aptitude_stream_fit

        academic_fit = calculate_academic_fit(assessment.academic_marks or body.academic_marks)
        aptitude_fit = calculate_aptitude_stream_fit(assessment.aptitude_scores)
        family_context = {
            "coaching_affordability": assessment.coaching_affordability or "",
            "mobility_willingness": assessment.mobility_willingness or "",
            "family_income": assessment.family_income or body.family_income,
            "parent_primary_concern": assessment.parent_primary_concern or "",
            "location_type": assessment.location_type or body.location_type,
        }
        feasibility_fit = calculate_family_feasibility(family_context)

        # Personality (TIPI Big Five)
        from engines.tipi_scorer import calculate_tipi_stream_fit, get_neuroticism_warning
        personality_fit = calculate_tipi_stream_fit(assessment.big_five_scores)

        rec = recommend_stream(
            riasec_scores=riasec_scores,
            academic_fit=academic_fit,
            aptitude_fit=aptitude_fit,
            personality_fit=personality_fit,
            feasibility_fit=feasibility_fit,
            self_efficacy=body.self_efficacy,
            career_readiness_score=assessment.career_readiness_score,
        )

        # Add neuroticism warning if applicable
        n_warning = get_neuroticism_warning(assessment.big_five_scores)
        if n_warning:
            rec["warnings"].append(n_warning)

        # Persist so /preview shows the same answer as the paid report.
        assessment.stream_recommendation = rec
        db.commit()

        career_teasers = [{"name": m.get("career_name", ""), "match_type": m.get("match_type", "")} for m in matched[:3]]

        logger.info(f"D2C assessment {token}: scored for {body.student_name} (Class {body.class_level}, Holland: {holland_code}, confidence: {rec['confidence']})")
        return {
            "token": token,
            "status": "assessment_complete",
            "holland_code": holland_code,
            "riasec_scores": riasec_scores,
            "recommended_stream": rec["recommended_stream"],
            "confidence": rec["confidence"],
            "career_teasers": career_teasers,
            "is_flat": rec["recommended_stream"] is None,
            "all_streams": rec["all_streams"],
            "dimension_count": rec["dimension_count"],
            "dimension_agreement": rec["dimension_agreement"],
            "explanation": rec["explanation"],
            "warnings": rec["warnings"],
            "data_completeness": rec["data_completeness"],
        }
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

        # Read the stored engine result. This previously used a separate
        # single-letter Holland lookup that ignored academic, aptitude,
        # personality and feasibility data, so the pre-payment teaser could
        # confidently name a stream the paid report then contradicted — or name
        # one where the engine had returned "Insufficient".
        rec = assessment.stream_recommendation or {}
        stream = rec.get("recommended_stream")
        confidence = rec.get("confidence", "")

        return {
            "token": token,
            "student_name": student.name,
            "class_level": student.class_level,
            "holland_code": student.holland_code,
            "riasec_scores": student.riasec_scores,
            "recommended_stream": stream,
            "confidence": confidence,
            "explanation": rec.get("explanation", ""),
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
    if not ENABLE_PAYMENTS:
        # No silent mock fallback. Previously an unconfigured Razorpay produced a
        # "mock_order_..." id that verify-payment auto-approved, so every paid
        # report was obtainable for zero rupees.
        raise HTTPException(
            status_code=503,
            detail="Online payments are not available yet.",
        )

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

        amount_inr = D2C_PRICING[tier]
        assessment.tier = tier
        assessment.amount_inr = amount_inr

        try:
            from services.razorpay_service import PaymentsNotConfigured, create_razorpay_order
            order = create_razorpay_order(
                amount_inr * 100, f"d2c_{assessment.id}", {"token": token, "tier": tier}
            )
        except PaymentsNotConfigured as e:
            logger.error(f"Payments enabled but Razorpay unusable: {e}")
            raise HTTPException(status_code=503, detail="Online payments are not available yet.")
        except Exception as e:
            # A transient Razorpay failure must surface as an error, never as a
            # free order.
            logger.exception(f"Razorpay order creation failed for {token}: {e}")
            raise HTTPException(status_code=502, detail="Could not reach the payment provider. Please try again.")

        assessment.razorpay_order_id = order["id"]
        db.commit()
        return {
            "order_id": order["id"],
            # Both units are returned explicitly. The old response sent a single
            # ambiguous "amount" in rupees which the client divided by 100,
            # displaying (and charging) Rs 4.99 for a Rs 499 tier.
            "amount_inr": amount_inr,
            "amount_paise": amount_inr * 100,
            "currency": "INR",
            "tier": tier,
            # Field name must match what the client checks to open the real
            # checkout; it read `razorpay_key` while this returned `key_id`, so
            # every customer fell through to the mock screen.
            "razorpay_key": order.get("key_id", ""),
        }
    finally:
        db.close()


@router.post("/verify-payment/{token}")
@limiter.limit("10/minute")
def verify_payment(request: Request, token: str, body: VerifyPaymentRequest):
    """Verify a Razorpay payment signature and trigger report generation."""
    if not ENABLE_PAYMENTS:
        raise HTTPException(status_code=503, detail="Online payments are not available yet.")

    db = SessionLocal()
    try:
        assessment = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        if assessment.payment_status == "paid":
            return {"status": "already_paid", "token": token}

        # The signature must belong to THIS assessment's order, otherwise a valid
        # signature from any other (possibly cheaper) order could be replayed here.
        if not assessment.razorpay_order_id or body.razorpay_order_id != assessment.razorpay_order_id:
            raise HTTPException(status_code=400, detail="Payment verification failed")

        try:
            from services.razorpay_service import PaymentsNotConfigured, verify_razorpay_payment
            verified = verify_razorpay_payment(
                body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature
            )
        except PaymentsNotConfigured as e:
            logger.error(f"Cannot verify payment, Razorpay unusable: {e}")
            raise HTTPException(status_code=503, detail="Online payments are not available yet.")

        if not verified:
            raise HTTPException(status_code=400, detail="Payment verification failed")

        assessment.payment_status = "paid"
        assessment.razorpay_payment_id = body.razorpay_payment_id
        assessment.paid_at = utcnow()
        assessment.status = "paid"
        db.commit()

        logger.info(f"D2C payment verified: {token} (tier={assessment.tier}, amount=Rs{assessment.amount_inr})")

        import threading
        thread = threading.Thread(target=_generate_d2c_report, args=(assessment.id,), daemon=True)
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

        # Run the same 17 validation checks the school pipeline runs. This used
        # to be "Skip QA for D2C (auto-pass)", so a malformed LLM response — the
        # report template gates every section on `{% if report.X %}` and Jinja's
        # default Undefined is silent — rendered a PDF with blank sections and
        # shipped it to a paying customer with nothing flagged anywhere.
        from engines.qa_checker import validate_report

        flags = validate_report(student)
        student.qa_flags = flags
        if flags:
            student.report_status = "qa_flagged"
            assessment.status = "qa_flagged"
            db.commit()
            logger.error(
                f"D2C report FAILED QA for {assessment.token}: {flags}. "
                "Holding for review instead of delivering."
            )
            return
        student.report_status = "qa_passed"
        db.commit()

        output_dir = OUTPUT_DIR / "d2c"
        output_dir.mkdir(parents=True, exist_ok=True)
        try:
            pdf_path = generate_student_pdf(student, output_dir, counsellor_name="CareerNeeti AI")
            student.pdf_path = str(pdf_path)
            student.report_status = "pdf_ready"
            assessment.pdf_url = str(pdf_path)
            assessment.status = "report_ready"
            assessment.completed_at = datetime.now(timezone.utc)
            db.commit()
            logger.info(f"D2C PDF generated: {pdf_path}")
        except Exception as e:
            logger.error(f"D2C PDF generation failed: {e}")
            assessment.status = "report_generating"  # Allow retry
            db.commit()

        # Send email delivery
        if assessment.student_email:
            try:
                from services.email_service import send_report_email
                stream_rec = (student.report_content or {}).get("stream_recommendation", {}).get("recommended_stream", "")
                sent = send_report_email(
                    to_email=assessment.student_email,
                    student_name=student.name,
                    pdf_path=str(pdf_path),
                    holland_code=student.holland_code or "",
                    stream=stream_rec,
                )
                if sent:
                    assessment.report_email_sent = True
                    db.commit()
            except Exception as e:
                logger.warning(f"D2C email delivery failed: {e}")

        # Send WhatsApp delivery
        if assessment.parent_phone:
            try:
                from services.whatsapp import WhatsAppService
                wa = WhatsAppService()
                result = wa.send_pdf(
                    phone=assessment.parent_phone,
                    pdf_path=str(pdf_path),
                    student_name=student.name,
                    school_name="CareerNeeti",
                )
                if result.get("success"):
                    assessment.report_whatsapp_sent = True
                    db.commit()
            except Exception as e:
                logger.warning(f"D2C WhatsApp delivery failed: {e}")

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
            filename=f"CareerNeeti_Report_{assessment.student_name.replace(' ', '_')}.pdf",
        )
    finally:
        db.close()
