from datetime import date
from sqlalchemy import (
    Boolean, Column, Integer, String, Text, Float, Date, DateTime,
    ForeignKey, JSON,
)
from sqlalchemy.orm import relationship
from database import Base
from utils.time import utcnow


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="counsellor")  # admin, counsellor, school_admin
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class School(Base):
    __tablename__ = "schools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    city = Column(String(100), nullable=False)
    board = Column(String(20), default="CBSE")  # CBSE / ICSE / State
    contact_person = Column(String(255), default="")
    contact_phone = Column(String(15), default="")
    # Soft delete. A hard DELETE cascades through Session -> Student and
    # permanently destroys every report, score and consent record for the
    # school, which is not something one API call should be able to do to a
    # DPDPA-regulated dataset.
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    sessions = relationship("Session", back_populates="school", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    session_date = Column(Date, nullable=False, default=date.today)
    classes_assessed = Column(JSON, default=list)  # e.g., [8, 9, 10, 12]
    counsellor_name = Column(String(255), default="")
    counsellor_certification = Column(String(255), default="")
    total_students = Column(Integer, default=0)
    opt_in_students = Column(Integer, default=0)
    status = Column(String(20), default="draft")
    llm_provider = Column(String(20), default="anthropic")
    total_cost = Column(Float, default=0.0)
    generation_started_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=utcnow)

    school = relationship("School", back_populates="sessions")
    students = relationship("Student", back_populates="session", cascade="all, delete-orphan")


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    student_id_external = Column(String(50), default="")
    name = Column(String(255), nullable=False)
    class_level = Column(Integer, nullable=False)  # 9, 10, 11, 12
    section = Column(String(10), default="")
    gender = Column(String(10), default="")  # male, female, other
    parent_name = Column(String(255), default="")
    parent_phone = Column(String(15), default="")

    # Socioeconomic context (Layer 3 of 3-Layer Assessment Model)
    family_income = Column(String(20), default="")  # "below_3l", "3_10l", "10_25l", "above_25l"
    location_type = Column(String(20), default="")  # "metro", "tier2", "rural"
    parental_education = Column(String(20), default="")  # "below_10th", "12th", "graduate", "postgrad"
    first_gen_learner = Column(Boolean, nullable=True)  # True if first in family to attend college

    # Self-efficacy scores (Layer 2 supplement — confidence in domains)
    self_efficacy = Column(JSON, nullable=True)  # {"maths": 4, "science": 5, "english": 3, "arts": 2, "business": 3, "social": 4}

    # RIASEC data
    riasec_raw_responses = Column(JSON, default=dict)  # {"Q1": "A", "Q2": "D", ...}
    riasec_scores = Column(JSON, default=dict)  # {"R": 72, "I": 85, ...}
    holland_code = Column(String(6), default="")
    work_values = Column(JSON, default=dict)
    matched_careers = Column(JSON, default=list)

    # Academic performance (optional — from student info CSV)
    academic_marks = Column(JSON, nullable=True)  # {"maths": 85, "science": 72, "english": 90, "overall_pct": 82}

    # Family context (Phase 2)
    coaching_affordability = Column(String(20), default="")   # "yes_easily", "yes_difficult", "no"
    mobility_willingness = Column(String(20), default="")     # "yes", "maybe", "no"
    parent_primary_concern = Column(String(30), default="")   # "job_security", "high_salary", "passion", "social_status"
    family_career_role_model = Column(String(100), default="")

    # Aptitude test (Phase 3)
    aptitude_raw_responses = Column(JSON, nullable=True)  # {"APT_N1": "B", "APT_V2": "A", ...}
    aptitude_scores = Column(JSON, nullable=True)          # {"numerical": 80, "verbal": 60, "spatial": 70, "total": 70}
    aptitude_time_taken = Column(Integer, nullable=True)   # seconds

    # Big Five TIPI (Section E)
    tipi_raw_responses = Column(JSON, nullable=True)   # {"BF1": "D", "BF2": "B", ...}
    big_five_scores = Column(JSON, nullable=True)       # {"O": 72, "C": 85, "E": 60, "A": 55, "N": 30}

    # Career Readiness (Section F)
    career_readiness_responses = Column(JSON, nullable=True)  # {"CR1": "D", ...}
    career_readiness_score = Column(Integer, nullable=True)    # 0-100
    career_readiness_level = Column(String(20), default="")    # "decision_ready", "exploring", etc.

    # Section D: Class 10 stream preference (from OMR form)
    stream_pref_parent = Column(String(50), default="")
    stream_pref_student = Column(String(50), default="")
    career_concern = Column(String(100), default="")

    # Report data
    report_content = Column(JSON, default=dict)  # Full LLM-generated report
    report_status = Column(String(20), default="pending")
    qa_flags = Column(JSON, default=list)
    pdf_path = Column(String(500), default="")
    report_token = Column(String(64), unique=True, nullable=True, index=True)  # UUID for web report link

    # Delivery
    delivery_status = Column(String(20), default="pending")
    delivery_timestamp = Column(DateTime(timezone=True), nullable=True)
    helpline_booked_at = Column(DateTime(timezone=True), nullable=True)   # Calendly booking confirmed

    # DPDPA consent tracking
    consent_obtained = Column(Boolean, default=False)
    consent_timestamp = Column(DateTime(timezone=True), nullable=True)
    consent_parent_name = Column(String(255), default="")
    consent_method = Column(String(20), default="")  # "paper_form", "verbal", "digital"

    # Cost tracking
    llm_cost = Column(Float, default=0.0)

    # students.d2c_assessment_id and d2c_assessments.student_id reference each
    # other, so the two tables form a foreign-key cycle. use_alter tells
    # SQLAlchemy/Alembic to add THIS side with a separate ALTER TABLE after both
    # tables exist. Without it, topological sorting is impossible and the
    # generated migration emits CREATE TABLE in an order Postgres rejects with
    # 'relation "students" does not exist'.
    d2c_assessment_id = Column(
        Integer,
        ForeignKey("d2c_assessments.id", use_alter=True),
        nullable=True,
    )

    created_at = Column(DateTime(timezone=True), default=utcnow)

    session = relationship("Session", back_populates="students")


class Lead(Base):
    __tablename__ = "leads"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), default="")
    phone = Column(String(15), default="")
    email = Column(String(255), default="")
    class_level = Column(Integer, nullable=True)
    holland_code = Column(String(6), default="")
    recommended_stream = Column(String(100), default="")
    riasec_scores = Column(JSON, default=dict)
    source = Column(String(50), default="free_quiz")
    utm_source = Column(String(100), default="")
    utm_medium = Column(String(100), default="")
    utm_campaign = Column(String(100), default="")
    converted = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class Feedback(Base):
    """Post-delivery parent satisfaction survey responses."""
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    rating = Column(Integer, nullable=True)                     # 1-5 stars
    recommendation_match = Column(Boolean, nullable=True)       # Did recommendation match parent's thinking?
    most_useful = Column(Text, default="")                       # Free text
    missing = Column(Text, default="")                          # Free text
    would_recommend = Column(Boolean, nullable=True)            # NPS proxy
    created_at = Column(DateTime(timezone=True), default=utcnow)


class AuditLog(Base):
    """Immutable audit trail for DPDPA compliance (who did what, when)."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)          # None = system/automated action
    action = Column(String(100), nullable=False)       # e.g. "report_generated", "pii_deleted"
    entity_type = Column(String(50), default="")       # "student", "session", "user"
    entity_id = Column(Integer, nullable=True)
    detail = Column(Text, default="")                  # free-form context
    ip_address = Column(String(45), default="")
    timestamp = Column(DateTime(timezone=True), default=utcnow, index=True)


class D2CAssessment(Base):
    __tablename__ = "d2c_assessments"
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(64), unique=True, nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    student_name = Column(String(255), default="")
    student_email = Column(String(255), default="")
    parent_phone = Column(String(15), default="")
    class_level = Column(Integer, default=10)
    tier = Column(String(20), default="basic")
    amount_inr = Column(Integer, default=499)
    razorpay_order_id = Column(String(100), default="")
    razorpay_payment_id = Column(String(100), default="")
    payment_status = Column(String(20), default="pending")
    paid_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(30), default="created")
    raw_responses = Column(JSON, default=dict)
    self_efficacy = Column(JSON, nullable=True)
    gender = Column(String(10), default="")
    family_income = Column(String(20), default="")
    location_type = Column(String(20), default="")
    parental_education = Column(String(20), default="")
    first_gen_learner = Column(Boolean, nullable=True)
    academic_marks = Column(JSON, nullable=True)
    coaching_affordability = Column(String(20), default="")
    mobility_willingness = Column(String(20), default="")
    parent_primary_concern = Column(String(30), default="")
    family_career_role_model = Column(String(100), default="")
    aptitude_raw_responses = Column(JSON, nullable=True)
    aptitude_scores = Column(JSON, nullable=True)
    aptitude_time_taken = Column(Integer, nullable=True)
    tipi_raw_responses = Column(JSON, nullable=True)
    big_five_scores = Column(JSON, nullable=True)
    career_readiness_responses = Column(JSON, nullable=True)
    career_readiness_score = Column(Integer, nullable=True)
    career_readiness_level = Column(String(20), default="")

    # Full multi-dimensional recommendation as computed at submit time. Persisted
    # so /preview and the paid report cannot disagree: /preview previously used a
    # separate single-letter Holland lookup that could name a stream the real
    # engine did not even rank first.
    stream_recommendation = Column(JSON, nullable=True)

    report_email_sent = Column(Boolean, default=False)
    report_whatsapp_sent = Column(Boolean, default=False)
    pdf_url = Column(String(500), default="")
    created_at = Column(DateTime(timezone=True), default=utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)


class StudentOutcome(Base):
    """6-month follow-up: what stream/career did the student actually choose?"""
    __tablename__ = "student_outcomes"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, unique=True)
    actual_stream_chosen = Column(String(100), default="")    # e.g. "Science (PCM)"
    actual_career_interest = Column(String(255), default="")  # free text
    recommendation_matched = Column(Boolean, nullable=True)   # did prediction match?
    notes = Column(Text, default="")
    collected_via = Column(String(20), default="whatsapp")    # "whatsapp", "manual", "form"
    updated_at = Column(DateTime(timezone=True), default=utcnow)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class SchoolAssignment(Base):
    """Counsellor ↔ School many-to-many with commission rate."""
    __tablename__ = "school_assignments"

    id = Column(Integer, primary_key=True, index=True)
    counsellor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    commission_rate = Column(Float, default=0.40)   # fraction — 0.40 = 40%
    is_active = Column(Boolean, default=True)
    notes = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=utcnow)


class CounsellorCommission(Base):
    """Per-session commission record for each counsellor."""
    __tablename__ = "counsellor_commissions"

    id = Column(Integer, primary_key=True, index=True)
    counsellor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    students_count = Column(Integer, default=0)       # number of students in session
    rate_per_student = Column(Integer, default=200)   # INR — 40% of ₹500
    amount_inr = Column(Integer, default=0)           # students_count × rate_per_student
    status = Column(String(20), default="pending")    # pending, paid
    paid_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=utcnow)
