import uuid
import logging
from datetime import date
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from database import SessionLocal
from models import AccessCode, AuditLog, Lead, D2CAssessment, Student, School, Session
from engines.scoring_engine import calculate_riasec_scores, determine_holland_code, match_careers, load_knowledge_base
from rate_limit import limiter
from config import DEFAULT_LLM_PROVIDER
from utils.self_efficacy import normalize_self_efficacy
from utils.time import utcnow

logger = logging.getLogger(__name__)
router = APIRouter()


def _inherited_consent(db, assessment: D2CAssessment) -> dict:
    """Consent fields for a Student created from an online assessment.

    Returns real values only where they are actually evidenced. A redeemed
    school access code points at a Session, and a school session is where a
    signed paper consent circular is collected — so that, and only that, is
    treated as parental consent here.

    Everything else gets False. An unconsented row is an honest gap; a
    fabricated one is a false record about a child, and materially worse.
    """
    if assessment.access_code_id is None:
        return {"consent_obtained": False, "consent_method": ""}

    code = db.query(AccessCode).filter(AccessCode.id == assessment.access_code_id).first()
    if code is None:
        return {"consent_obtained": False, "consent_method": ""}

    return {
        "consent_obtained": True,
        "consent_method": "paper_form",
        "consent_timestamp": utcnow(),
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
            llm_provider=DEFAULT_LLM_PROVIDER,
        )
        db.add(session)
        db.flush()
    return session


class StartRequest(BaseModel):
    # The free quiz hands off with `lead.token` — a 32-char uuid4 hex, not an id.
    # This field was `lead_id: Optional[int]`, so pydantic rejected every one of
    # those with `int_parsing` and /start returned 422 for the single
    # highest-intent cohort in the funnel: people who finished the free quiz and
    # clicked through for the full report. It is also why `Lead.converted` was
    # never able to become True.
    lead_token: Optional[str] = None
    # Accepted for older clients that still post an integer id directly.
    lead_id: Optional[int] = None
    student_name: str = ""
    # The frontend historically posted `email`; the mismatch meant pydantic's
    # extra="ignore" silently dropped it, so any lead abandoning before /submit
    # had no email on file. Accept both spellings.
    student_email: str = ""
    email: Optional[str] = None
    parent_phone: str = ""
    class_level: int = 10

    def resolved_email(self) -> str:
        return (self.student_email or self.email or "").strip()

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

@router.post("/start")
@limiter.limit("30/minute")
def start_assessment(request: Request, body: StartRequest = StartRequest()):
    """Create a new D2C assessment. Returns a token for all subsequent calls."""
    token = uuid.uuid4().hex
    db = SessionLocal()
    try:
        # Resolve the quiz hand-off token to the Lead it belongs to. An unknown
        # or absent token is not an error: starting the assessment cold, without
        # taking the free quiz first, is a legitimate entry point.
        lead_id = body.lead_id
        if lead_id is None and body.lead_token:
            lead = db.query(Lead).filter(Lead.token == body.lead_token).first()
            if lead:
                lead_id = lead.id

        assessment = D2CAssessment(
            token=token,
            lead_id=lead_id,
            student_name=body.student_name,
            student_email=body.resolved_email(),
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


class RedeemCodeRequest(BaseModel):
    code: str = ""


@router.post("/redeem/{token}")
@limiter.limit("10/minute")
def redeem_access_code(request: Request, token: str, body: RedeemCodeRequest):
    """Redeem a school-issued code against this assessment.

    Rate-limited because the code space is guessable by design — they are handed
    out on paper and typed by parents, so they are short.
    """
    entered = (body.code or "").strip().upper()
    if not entered:
        raise HTTPException(status_code=400, detail="Enter the code from your school.")

    db = SessionLocal()
    try:
        assessment = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        if assessment.access_code_id is not None:
            return {"status": "already_redeemed"}

        code = db.query(AccessCode).filter(AccessCode.code == entered).first()
        if not code:
            # Deliberately identical to the exhausted/expired wording below, so a
            # caller cannot probe which codes exist.
            raise HTTPException(
                status_code=404, detail="That code is not valid. Please check with your school."
            )
        reason = code.redeemable_reason()
        if reason:
            raise HTTPException(status_code=409, detail=reason)

        code.times_used = (code.times_used or 0) + 1
        assessment.access_code_id = code.id
        db.add(AuditLog(
            action="access_code_redeemed",
            entity_type="d2c_assessment",
            entity_id=assessment.id,
            detail=f"code={code.code} session_id={code.session_id}",
        ))
        db.commit()
        logger.info(f"Access code {code.code} redeemed for assessment {token}")
        return {"status": "redeemed", "session_id": code.session_id}
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

        # SubmitRequest documents 0 as "fall back to the value given at /start",
        # but this checked the request field directly — so a client that omitted
        # it got a hard 400 at the end of a 40-minute assessment, with every
        # answer already typed and nothing saying which field was wrong.
        class_level = body.class_level or assessment.class_level or 0
        if class_level not in (9, 10, 11, 12):
            raise HTTPException(status_code=400, detail="Class must be 9, 10, 11, or 12")
        body.class_level = class_level

        # Fall back to values stored at /start if not provided in submit body
        if not body.student_name:
            body.student_name = assessment.student_name or "Student"
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

        # Route the student into the session their access code belongs to, so
        # they appear on the counsellor's roster for that school visit and are
        # picked up by the batch generate / QA / PDF run. Only a student with no
        # code falls back to the synthetic online session.
        target_session = None
        if assessment.access_code_id is not None:
            code = db.query(AccessCode).filter(
                AccessCode.id == assessment.access_code_id
            ).first()
            if code is not None:
                target_session = db.query(Session).filter(
                    Session.id == code.session_id
                ).first()
        if target_session is None:
            target_session = get_or_create_d2c_session(db)

        # Create Student record
        student = Student(
            session_id=target_session.id,
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
            # Consent is inherited, never asserted here. This used to be a
            # hardcoded True with method "digital" — the same label a real OTP
            # verification writes, so a fabricated record was indistinguishable
            # from a genuine one, and school_portal computed a "consent_rate"
            # from it that the UI labelled DPDPA compliant.
            #
            # A redeemed school code carries the consent evidenced by that
            # session's signed paper circular. Without one there is no consent,
            # and it stays False until a real verification writes it.
            **_inherited_consent(db, assessment),
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


@router.get("/status/{token}")
def check_status(token: str):
    """Check assessment and report generation status."""
    db = SessionLocal()
    try:
        assessment = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")

        # The student sees only whether their answers were received. The report
        # itself is generated in batch by the counsellor and handed over as a
        # PDF, so there is nothing here for them to poll for or download.
        return {
            "token": token,
            "status": assessment.status,
            "submitted": assessment.student_id is not None,
        }
    finally:
        db.close()

