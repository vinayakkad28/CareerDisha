from datetime import datetime, date
from sqlalchemy import (
    Boolean, Column, Integer, String, Text, Float, Date, DateTime,
    ForeignKey, JSON, Enum as SAEnum,
)
from sqlalchemy.orm import relationship
from database import Base


class School(Base):
    __tablename__ = "schools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    city = Column(String(100), nullable=False)
    board = Column(String(20), default="CBSE")  # CBSE / ICSE / State
    contact_person = Column(String(255), default="")
    contact_phone = Column(String(15), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

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
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    school = relationship("School", back_populates="sessions")
    students = relationship("Student", back_populates="session", cascade="all, delete-orphan")


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    student_id_external = Column(String(50), default="")
    name = Column(String(255), nullable=False)
    class_level = Column(Integer, nullable=False)  # 8, 9, 10, 11, 12
    section = Column(String(10), default="")
    parent_name = Column(String(255), default="")
    parent_phone = Column(String(15), default="")

    # RIASEC data
    riasec_raw_responses = Column(JSON, default=dict)  # {"Q1": "A", "Q2": "D", ...}
    riasec_scores = Column(JSON, default=dict)  # {"R": 72, "I": 85, ...}
    holland_code = Column(String(6), default="")
    work_values = Column(JSON, default=dict)
    matched_careers = Column(JSON, default=list)

    # Report data
    report_content = Column(JSON, default=dict)  # Full LLM-generated report
    report_status = Column(String(20), default="pending")
    qa_flags = Column(JSON, default=list)
    pdf_path = Column(String(500), default="")

    # Delivery
    delivery_status = Column(String(20), default="pending")
    delivery_timestamp = Column(DateTime, nullable=True)

    # DPDPA consent tracking
    consent_obtained = Column(Boolean, default=False)
    consent_timestamp = Column(DateTime, nullable=True)
    consent_parent_name = Column(String, default="")
    consent_method = Column(String, default="")  # "paper_form", "verbal", "digital"

    # Cost tracking
    llm_cost = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="students")
