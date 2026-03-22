import asyncio
import json
from pathlib import Path

from database import SessionLocal
from models import Session, Student


def run_report_generation(session_id: int, provider: str = "anthropic"):
    """Background task: generate LLM reports for all scored students in a session."""
    from engines.report_generator import generate_single_report
    from engines.scoring_engine import load_knowledge_base

    db = SessionLocal()
    try:
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            return

        kb = load_knowledge_base()
        students = db.query(Student).filter(
            Student.session_id == session_id,
            Student.report_status == "scored",
        ).all()

        total_cost = 0.0
        for i, student in enumerate(students):
            try:
                cost = generate_single_report(student, kb, provider, db)
                total_cost += cost
                student.report_status = "report_generated"
                db.commit()
            except Exception as e:
                print(f"Error generating report for {student.name}: {e}")
                continue

        session.total_cost = total_cost
        session.status = "generated"
        db.commit()
    finally:
        db.close()


def run_pdf_generation(session_id: int):
    """Background task: generate PDFs for all students with reports."""
    from engines.pdf_generator import generate_student_pdf

    db = SessionLocal()
    try:
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            return

        students = db.query(Student).filter(
            Student.session_id == session_id,
            Student.report_status.in_(["qa_passed", "report_generated"]),
        ).all()

        output_dir = Path("output") / f"session_{session_id}"
        output_dir.mkdir(parents=True, exist_ok=True)

        for student in students:
            try:
                pdf_path = generate_student_pdf(student, output_dir)
                student.pdf_path = str(pdf_path)
                student.report_status = "pdf_ready"
                db.commit()
            except Exception as e:
                print(f"Error generating PDF for {student.name}: {e}")
                continue

        session.status = "pdf_ready"
        db.commit()
    finally:
        db.close()
