"""DPDPA retention cleanup — anonymise student PII after 90-day retention window.

Run daily (e.g. via Railway cron, Heroku Scheduler, or a simple cron job).
Safe to run multiple times — already-anonymised records are skipped.
"""
import logging
from datetime import datetime, timedelta, timezone

from database import SessionLocal
from models import Student, AuditLog

logger = logging.getLogger(__name__)

RETENTION_DAYS = 90  # DPDPA: retain PII only as long as necessary


def run_retention_cleanup() -> dict:
    """Anonymise PII for students delivered more than RETENTION_DAYS ago.

    Keeps: riasec_scores, holland_code, matched_careers, class_level, session_id
    (needed for aggregate analytics and CBSE reporting).
    Clears: name, parent_name, parent_phone, riasec_raw_responses, report_content.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    db = SessionLocal()
    anonymised = 0
    skipped = 0

    try:
        candidates = (
            db.query(Student)
            .filter(
                Student.report_status == "delivered",
                Student.consent_timestamp < cutoff,
                # Skip already-anonymised rows (name starts with [REDACTED])
                ~Student.name.like("[REDACTED%"),
            )
            .all()
        )

        logger.info(f"Retention cleanup: {len(candidates)} student(s) eligible for anonymisation (cutoff={cutoff.date()})")

        for student in candidates:
            try:
                original_name = student.name
                student.name = f"[REDACTED-{student.id}]"
                student.parent_name = ""
                student.parent_phone = ""
                student.riasec_raw_responses = {}
                student.report_content = {}
                student.consent_parent_name = ""

                audit = AuditLog(
                    user_id=None,
                    action="pii_auto_deleted",
                    entity_type="student",
                    entity_id=student.id,
                    detail=(
                        f"Automated DPDPA cleanup: PII anonymised after {RETENTION_DAYS}-day retention. "
                        f"Original consent date: {student.consent_timestamp.date() if student.consent_timestamp else 'unknown'}. "
                        f"Student: {original_name}"
                    ),
                )
                db.add(audit)
                db.commit()
                anonymised += 1
                logger.info(f"  Anonymised student ID {student.id} ({original_name})")
            except Exception as e:
                db.rollback()
                skipped += 1
                logger.error(f"  Failed to anonymise student ID {student.id}: {e}", exc_info=True)

        logger.info(f"Retention cleanup complete: {anonymised} anonymised, {skipped} failed.")
        return {"anonymised": anonymised, "skipped": skipped, "cutoff": cutoff.isoformat()}
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = run_retention_cleanup()
    print(result)
