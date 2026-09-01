import logging
import os
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed

from config import OUTPUT_DIR, MAX_CONCURRENT_REQUESTS, DEFAULT_LLM_PROVIDER
from database import SessionLocal
from models import Session, Student

logger = logging.getLogger(__name__)


def _retry(fn, *args, max_retries: int = 3, base_delay: float = 2.0, **kwargs):
    """Call fn(*args, **kwargs) up to max_retries times with exponential backoff."""
    last_exc = None
    for attempt in range(1, max_retries + 1):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            last_exc = e
            if attempt < max_retries:
                delay = base_delay * (2 ** (attempt - 1))
                logger.warning(f"Attempt {attempt}/{max_retries} failed ({e}). Retrying in {delay:.0f}s...")
                time.sleep(delay)
    raise last_exc


def _generate_one(student_id: int, kb: dict, provider: str) -> tuple[float, str | None]:
    """Worker: generate a single student report in its own DB session.

    Returns (cost, error_message). Each worker owns its own session so that
    concurrent threads don't share SQLAlchemy state.
    """
    from engines.report_generator import generate_single_report

    db = SessionLocal()
    try:
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            return 0.0, f"Student {student_id} not found"
        if not student.consent_obtained:
            return 0.0, "no_consent"
        cost = _retry(generate_single_report, student, kb, provider, db)
        student.report_status = "report_generated"
        db.commit()
        return cost, None
    except Exception as e:
        return 0.0, str(e)
    finally:
        db.close()


def run_report_generation(session_id: int, provider: str = ""):
    """Background task: generate LLM reports for all scored students in a session.

    Processes up to MAX_CONCURRENT_REQUESTS students in parallel using a thread pool.
    Checkpoint: students already in report_generated/qa_passed/qa_flagged status are
    skipped automatically, so restarting the task is safe and idempotent.
    """
    from engines.scoring_engine import load_knowledge_base

    # Same reason as generate_single_report: a vendor literal here silently
    # overrides a deployment configured for another provider. The only caller
    # passes session.llm_provider explicitly, so this default is a latent trap
    # rather than an active bug — but it is the same trap.
    provider = provider or DEFAULT_LLM_PROVIDER

    db = SessionLocal()
    try:
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            logger.error(f"Session {session_id} not found for report generation")
            return

        kb = load_knowledge_base()
        # Checkpoint: only process students not yet generated (safe to restart)
        students = db.query(Student).filter(
            Student.session_id == session_id,
            Student.report_status == "scored",
        ).all()
        student_ids = [s.id for s in students]

        logger.info(
            f"Session {session_id}: generating reports for {len(student_ids)} students "
            f"with provider={provider}, concurrency={MAX_CONCURRENT_REQUESTS}"
        )

        total_cost = 0.0
        completed = 0
        failed = 0
        skipped_no_consent = 0

        with ThreadPoolExecutor(max_workers=MAX_CONCURRENT_REQUESTS) as pool:
            futures = {
                pool.submit(_generate_one, sid, kb, provider): sid
                for sid in student_ids
            }
            for future in as_completed(futures):
                sid = futures[future]
                cost, err = future.result()
                if err == "no_consent":
                    skipped_no_consent += 1
                    logger.warning(f"  Skipping student ID {sid} — no consent recorded")
                elif err:
                    failed += 1
                    logger.error(f"  All retries exhausted for student ID {sid}: {err}")
                else:
                    total_cost += cost
                    completed += 1
                    logger.info(f"  Report generated for student ID {sid} (cost: ${cost:.4f})")

        session.total_cost = total_cost
        # Same reasoning as the PDF stage: do not advance the session unless a
        # report was actually produced. Otherwise a run where every student
        # failed (a bad LLM key, say) or was skipped for missing consent still
        # reported "generated", and the UI showed the stage complete with 0/N.
        if completed:
            session.status = "generated"
        else:
            logger.error(
                f"Session {session_id}: produced no reports "
                f"({failed} failed, {skipped_no_consent} skipped for missing consent). "
                "Session status left unchanged so it can be retried."
            )
        db.commit()
        logger.info(
            f"Session {session_id}: report generation complete. "
            f"{completed} succeeded, {failed} failed, {skipped_no_consent} skipped (no consent). "
            f"Total cost: ${total_cost:.4f}"
        )
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

        base_url = os.getenv("APP_BASE_URL", "https://careerneeti.in")
        logger.info(f"Session {session_id}: generating PDFs for {len(students)} students in {output_dir}")
        completed = 0
        failed = 0
        for student in students:
            try:
                # Assign a stable report token if not already set
                if not student.report_token:
                    student.report_token = uuid.uuid4().hex
                    db.commit()
                web_report_url = f"{base_url}/reports/{student.report_token}"
                pdf_path = generate_student_pdf(
                    student, output_dir,
                    counsellor_name=counsellor_name,
                    web_report_url=web_report_url,
                )
                student.pdf_path = str(pdf_path)
                student.report_status = "pdf_ready"
                db.commit()
                completed += 1
            except Exception as e:
                failed += 1
                logger.error(f"  Error generating PDF for {student.name} (ID {student.id}): {e}", exc_info=True)
                continue

        # Only advance the session when something was actually produced.
        # This used to be unconditional, so clicking "Generate PDFs" before any
        # report existed marked the session "pdf_ready" with zero PDFs — the
        # stepper and status badge both claimed success while the counters read
        # 0/N and Download ZIP stayed (correctly) disabled.
        if completed:
            session.status = "pdf_ready"
            db.commit()
        elif not students:
            logger.warning(
                f"Session {session_id}: no QA-passed students, so no PDFs to generate. "
                "Generate reports and run QA first. Session status left unchanged."
            )
        else:
            logger.error(
                f"Session {session_id}: all {failed} PDF generation(s) failed. "
                "Session status left unchanged."
            )
        logger.info(f"Session {session_id}: PDF generation complete. {completed} succeeded, {failed} failed.")
    except Exception as e:
        logger.error(f"Session {session_id}: PDF generation batch failed: {e}", exc_info=True)
    finally:
        db.close()
