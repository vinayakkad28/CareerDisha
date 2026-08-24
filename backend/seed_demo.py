"""Seed demo data for CareerNeeti.

Run: python seed_demo.py
Creates a demo school, session, and 5 sample students with pre-computed RIASEC scores and sample report content.
"""

import json
from datetime import date, datetime
from utils.time import utcnow
from database import SessionLocal, init_db
from models import School, Session, Student


DEMO_STUDENTS = [
    {
        "student_id_external": "D001",
        "name": "Aarav Sharma",
        "class_level": 10,
        "section": "A",
        "parent_name": "Rajesh Sharma",
        "parent_phone": "919876543210",
        "riasec_scores": {"R": 45, "I": 88, "A": 35, "S": 52, "E": 40, "C": 38},
        "holland_code": "ISR",
        "work_values": {"security": 3, "independence": 4, "continuous_learning": 5, "social_impact": 3, "high_income": 4, "creativity": 3, "adventure": 2, "structured_environment": 3},
        "profile_type": "Science/Engineering fit",
    },
    {
        "student_id_external": "D002",
        "name": "Priya Singh",
        "class_level": 10,
        "section": "A",
        "parent_name": "Meera Singh",
        "parent_phone": "919876543211",
        "riasec_scores": {"R": 30, "I": 35, "A": 42, "S": 82, "E": 75, "C": 45},
        "holland_code": "SEA",
        "work_values": {"security": 4, "independence": 3, "continuous_learning": 3, "social_impact": 5, "high_income": 3, "creativity": 4, "adventure": 3, "structured_environment": 2},
        "profile_type": "Commerce/Management fit",
    },
    {
        "student_id_external": "D003",
        "name": "Rohan Gupta",
        "class_level": 9,
        "section": "B",
        "parent_name": "Amit Gupta",
        "parent_phone": "919876543212",
        "riasec_scores": {"R": 38, "I": 42, "A": 78, "S": 70, "E": 35, "C": 28},
        "holland_code": "ASI",
        "work_values": {"security": 2, "independence": 4, "continuous_learning": 3, "social_impact": 4, "high_income": 2, "creativity": 5, "adventure": 4, "structured_environment": 1},
        "profile_type": "Arts/Humanities fit",
    },
    {
        "student_id_external": "D004",
        "name": "Sneha Patel",
        "class_level": 12,
        "section": "A",
        "parent_name": "Vikram Patel",
        "parent_phone": "919876543213",
        "riasec_scores": {"R": 52, "I": 48, "A": 50, "S": 55, "E": 45, "C": 50},
        "holland_code": "SRI",
        "work_values": {"security": 4, "independence": 3, "continuous_learning": 3, "social_impact": 3, "high_income": 3, "creativity": 3, "adventure": 3, "structured_environment": 4},
        "profile_type": "Flat/Undecided profile",
    },
    {
        "student_id_external": "D005",
        "name": "Arjun Verma",
        "class_level": 11,
        "section": "A",
        "parent_name": "Sunita Verma",
        "parent_phone": "919876543214",
        "riasec_scores": {"R": 32, "I": 40, "A": 28, "S": 35, "E": 85, "C": 78},
        "holland_code": "ECI",
        "work_values": {"security": 5, "independence": 3, "continuous_learning": 2, "social_impact": 2, "high_income": 5, "creativity": 1, "adventure": 2, "structured_environment": 5},
        "profile_type": "Commerce/Finance fit",
    },
]


def seed():
    init_db()
    db = SessionLocal()
    try:
        # Check if demo data already exists
        existing = db.query(School).filter(School.code == "DEMO01").first()
        if existing:
            print("Demo data already exists. Skipping.")
            return

        # Create demo school
        school = School(
            name="Demo Public School",
            code="DEMO01",
            city="Meerut",
            board="CBSE",
            contact_person="Demo Principal",
            contact_phone="919800000000",
        )
        db.add(school)
        db.flush()

        # Create demo session
        session = Session(
            school_id=school.id,
            session_date=date.today(),
            classes_assessed=[9, 10, 11, 12],
            counsellor_name="Vinayak Kad",
            llm_provider="groq",
            total_students=5,
            status="scored",
            notes="Demo session with pre-loaded sample data",
        )
        db.add(session)
        db.flush()

        # Load knowledge base for career matching
        from engines.scoring_engine import match_careers, load_knowledge_base
        kb = load_knowledge_base()

        # Create students
        for s_data in DEMO_STUDENTS:
            matched = match_careers(s_data["holland_code"], kb, top_n=10)
            student = Student(
                session_id=session.id,
                student_id_external=s_data["student_id_external"],
                name=s_data["name"],
                class_level=s_data["class_level"],
                section=s_data["section"],
                parent_name=s_data["parent_name"],
                parent_phone=s_data["parent_phone"],
                riasec_scores=s_data["riasec_scores"],
                holland_code=s_data["holland_code"],
                work_values=s_data["work_values"],
                matched_careers=matched,
                riasec_raw_responses={f"Q{i}": "C" for i in range(1, 75)},  # Placeholder
                report_status="scored",
                consent_obtained=True,
                consent_timestamp=utcnow(),
                consent_method="paper_form",
            )
            db.add(student)
            print(f"  Added {s_data['name']} (Class {s_data['class_level']}, {s_data['profile_type']})")

        db.commit()
        print(f"\nDemo data seeded successfully!")
        print(f"  School: {school.name} (ID: {school.id})")
        print(f"  Session ID: {session.id}")
        print(f"  Students: {len(DEMO_STUDENTS)}")
        print(f"\nYou can now log in and see the demo data in the dashboard.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()