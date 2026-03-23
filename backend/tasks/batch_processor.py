import logging

from config import OUTPUT_DIR
from database import SessionLocal
from models import Session, Student

logger = logging.getLogger(__name__)


def run_report_generation(session_id: int, provider: str = "anthropic"):
    """Background task: generate LLM reports for all scored students in a session."""
    from engines.report_generator import generate_single_report
    from engines.scoring_engine import load_knowledge_base

    db = SessionLocal()
    try:
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            logger.error(f"Session {session_id} not found for report generation")
            return

        kb = load_knowledge_base()
        students = db.query(Student).filter(
            Student.session_id == session_id,
            Student.report_status == "scored",
        ).all()

        logger.info(f"Session {session_id}: generating reports for {len(students)} students with provider={provider}")
        total_cost = 0.0
        completed = 0
        failed = 0
        for student in students:
            try:
                cost = generate_single_report(student, kb, provider, db)
                total_cost += cost
                student.report_status = "report_generated"
                db.commit()
                completed += 1
                logger.info(f"  [{completed}/{len(students)}] Report generated for {student.name} (cost: ${cost:.4f})")
            except Exception as e:
                failed += 1
                logger.error(f"  Error generating report for {student.name} (ID {student.id}): {e}", exc_info=True)
                continue

        session.total_cost = total_cost
        session.status = "generated"
        db.commit()
        logger.info(f"Session {session_id}: report generation complete. {completed} succeeded, {failed} failed. Total cost: ${total_cost:.4f}")
    except Exception as e:
        logger.error(f"Session {session_id}: report generation batch failed: {e}", exc_info=True)
        try:
            session = db.query(Session).filter(Session.id == session_id).first()
            if session:
                session.status = "scored"  # Revert to allow retry
                session.notes = (session.notes or "") + f"\nReport generation failed: {e}"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


def run_pdf_generation(session_id: int):
    """Background task: generate PDFs for students that passed QA."""
    from engines.pdf_generator import generate_student_pdf

    db = SessionLocal()
    try:
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            logger.error(f"Session {session_id} not found for PDF generation")
            return

        # Only generate PDFs for QA-passed students
        students = db.query(Student).filter(
            Student.session_id == session_id,
            Student.report_status == "qa_passed",
        ).all()

        output_dir = OUTPUT_DIR / f"session_{session_id}"
        output_dir.mkdir(parents=True, exist_ok=True)

        counsellor_name = session.counsellor_name or ""

        logger.info(f"Session {session_id}: generating PDFs for {len(students)} students in {output_dir}")
        completed = 0
        failed = 0
        for student in students:
            try:
                pdf_path = generate_student_pdf(student, output_dir, counsellor_name=counsellor_name)
                student.pdf_path = str(pdf_path)
                student.report_status = "pdf_ready"
                db.commit()
                completed += 1
            except Exception as e:
                failed += 1
                logger.error(f"  Error generating PDF for {student.name} (ID {student.id}): {e}", exc_info=True)
                continue

        session.status = "pdf_ready"
        db.commit()
        logger.info(f"Session {session_id}: PDF generation complete. {completed} succeeded, {failed} failed.")
    except Exception as e:
        logger.error(f"Session {session_id}: PDF generation batch failed: {e}", exc_info=True)
    finally:
        db.close()
