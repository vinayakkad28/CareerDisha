import uuid
import logging
from datetime import datetime, date, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from database import get_db, SessionLocal
from models import AccessCode, AuditLog, Lead, D2CAssessment, Student, School, Session
from engines.scoring_engine import calculate_riasec_scores, determine_holland_code, match_careers, load_knowledge_base
from rate_limit import limiter
from config import FREE_REPORTS, DEFAULT_LLM_PROVIDER
from utils.self_efficacy import normalize_self_efficacy
from utils.time import utcnow

logger = logging.getLogger(__name__)
router = APIRouter()


def report_is_unlocked(assessment: D2CAssessment) -> bool:
    """Whether this assessment's report may be generated and handed over.

    Every gate on the report — preview, JSON, PDF, and the public web report —
    routes through here so they cannot drift apart. Two ways to be unlocked:

    * a school-issued access code was redeemed (the pilot's route);
    * FREE_REPORTS is on, which is a deliberate open-house switch.

    There is no online payment. Fees are collected offline at the school
    session, and the code handed out there is what carries the entitlement.

    The code path matters for more than money. The site was giving away, free,
    the identical report parents were being charged ₹500 for at a school session
    — one parent with a phone during the pitch ends the pilot. And because every
    code is issued against a Session, redeeming one inherits the parental consent
    evidenced by that session's signed paper form, instead of the online flow
    asserting consent a child gave on their own behalf.

    The payment columns on D2CAssessment are left dormant rather than dropped,
    so nothing here writes or reads them.
    """
    if assessment.access_code_id is not None:
        return True
    return FREE_REPORTS


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


# Statuses in which a report has cleared review and may be handed over.
DELIVERABLE_REPORT_STATUSES = ("qa_passed", "pdf_ready", "delivered")


def assert_report_is_deliverable(assessment: D2CAssessment, student: Student) -> None:
    """Raise unless this report may be handed to the customer.

    Two independent conditions, and both must hold. Unlocking (a redeemed school
    code, or the open-house switch) is about entitlement. This is about fitness
    to send: a QA hold means the pipeline found a structural defect, and a held
    report must not leak out of a side door.

    That side door was real — on-demand PDF regeneration rebuilds from
    `report_content`, which exists as soon as the model returns, so a flagged
    report was downloadable while its status still said it was being held.
    """
    if not report_is_unlocked(assessment):
        raise HTTPException(
            status_code=402,
            detail="Access code required",
        )
    if student is not None and student.report_status not in DELIVERABLE_REPORT_STATUSES:
        if student.report_status == "qa_flagged":
            raise HTTPException(
                status_code=409,
                detail="This report is held for a quality check and is not ready yet.",
            )
        raise HTTPException(status_code=404, detail="Report not ready yet")

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

        # In the free beta there is no purchase decision to wait for, so the
        # report starts building the moment the assessment is scored. Without
        # this, generation is unreachable: the only other caller is
        # verify_payment, which returns 503 while payments are off — which is
        # why no report was ever produced through the online funnel.
        if FREE_REPORTS:
            _start_report_generation(assessment.id)

        return {
            "token": token,
            "status": "report_generating" if FREE_REPORTS else "assessment_complete",
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
            "report_locked": not report_is_unlocked(assessment),
        }
    finally:
        db.close()


def _start_report_generation(assessment_id: int) -> None:
    """Kick off report generation for an assessment, off the request thread.

    Single entry point so the free-beta path and the paid path start work the
    same way. Note the known weakness this inherits: a bare daemon thread has no
    watchdog, so a container recycle mid-generation strands the row at
    "report_generating" with nothing to re-drive it. The startup sweep in
    main.py's lifespan is what recovers those.
    """
    import threading

    thread = threading.Thread(
        target=_generate_d2c_report, args=(assessment_id,), daemon=True
    )
    thread.start()


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
            # This was a vendor literal, which pinned every online report to
            # llama-3.1-8b-instant no matter what the deployment was configured
            # for — while /api/health cheerfully reported the real provider. The
            # repo's own fix_groq.py rates 8B models 0, "too small for this
            # schema": they truncate the ~20-section report JSON, which then
            # fails QA and strands the customer. Honour the configured provider.
            cost = generate_single_report(student, kb, DEFAULT_LLM_PROVIDER, db)
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
        # Block on real structural defects only. `[WARNING]` flags are advisory
        # — a personal_note under 200 characters, fewer than three recommended
        # books — and holding a finished report for those left the customer
        # polling a spinner forever with no route out and no notification. The
        # school pipeline already draws this line (qa_checker.run_qa_checks);
        # D2C was the outlier. Warnings are still recorded on the row.
        hard_flags = [f for f in flags if not f.startswith("[WARNING]")]
        if hard_flags:
            student.report_status = "qa_flagged"
            assessment.status = "qa_flagged"
            db.commit()
            logger.error(
                f"D2C report FAILED QA for {assessment.token}: {hard_flags}. "
                "Holding for review instead of delivering."
            )
            return
        if flags:
            logger.warning(
                f"D2C report for {assessment.token} delivered with advisory "
                f"flags: {flags}"
            )
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

        # No WhatsApp delivery. Reports are handed over offline at the school.
        #
        # What stood here imported a WhatsAppService class that has never existed
        # — the module was function-based — and called an async function
        # synchronously. The ImportError was swallowed by a broad except into a
        # logger.warning, so `report_whatsapp_sent` was never once True and no
        # parent ever received a report this way. Removing it changes nothing at
        # runtime; the column is left dormant.

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
            # Regeneration (see download_pdf) means a report with content is
            # still deliverable even when the rendered file is gone.
            "pdf_available": bool(assessment.pdf_url) or bool(assessment.student_id),
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
        if not assessment.student_id:
            raise HTTPException(status_code=400, detail="Report not yet generated")

        student = db.query(Student).filter(Student.id == assessment.student_id).first()
        assert_report_is_deliverable(assessment, student)
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
        pdf_student = (
            db.query(Student).filter(Student.id == assessment.student_id).first()
            if assessment.student_id
            else None
        )
        assert_report_is_deliverable(assessment, pdf_student)

        pdf_path = Path(assessment.pdf_url) if assessment.pdf_url else None

        # The stored path routinely outlives the file. OUTPUT_DIR is /tmp/output
        # on the hosted free plan, which is wiped on every deploy and idle
        # recycle, so a customer returning to their link the next day used to get
        # a permanent "PDF not ready yet" for a report that exists perfectly well
        # in the database. Re-render it instead of 404ing: every input
        # generate_student_pdf needs is a persisted column, so this costs a
        # couple of seconds of CPU and no LLM call.
        if pdf_path is None or not pdf_path.exists():
            student = pdf_student
            if not student or not student.report_content:
                raise HTTPException(status_code=404, detail="Report not ready yet")

            # Imported here, not at module scope: matplotlib and WeasyPrint cost
            # real resident memory, and this process runs in 512MB.
            from engines.pdf_generator import generate_student_pdf
            from config import OUTPUT_DIR

            try:
                output_dir = OUTPUT_DIR / "d2c"
                output_dir.mkdir(parents=True, exist_ok=True)
                pdf_path = generate_student_pdf(
                    student, output_dir, counsellor_name="CareerNeeti AI"
                )
            except Exception as e:
                logger.error(
                    f"PDF regeneration failed for {token}: {e}", exc_info=True
                )
                raise HTTPException(
                    status_code=503,
                    detail="Could not rebuild the report right now. Please try again.",
                )

            student.pdf_path = str(pdf_path)
            assessment.pdf_url = str(pdf_path)
            db.commit()
            logger.info(f"Regenerated missing PDF for {token}")

        return FileResponse(
            str(pdf_path),
            media_type="application/pdf",
            filename=f"CareerNeeti_Report_{assessment.student_name.replace(' ', '_')}.pdf",
        )
    finally:
        db.close()
