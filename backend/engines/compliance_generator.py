"""CBSE Compliance Certificate PDF Generator."""

import hashlib
import logging
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

from config import TEMPLATES_DIR, OUTPUT_DIR

logger = logging.getLogger(__name__)


def generate_compliance_pdf(
    school_name: str,
    school_code: str,
    school_city: str,
    school_board: str,
    session_date_str: str,
    session_date_short: str,
    counsellor_name: str,
    counsellor_certification: str,
    classes_assessed: str,
    total_students: int,
    reports_done: int,
    delivered: int,
    consent_count: int,
    session_id: int,
) -> Path:
    """Generate a CBSE compliance certificate PDF. Returns file path."""
    ref_number = hashlib.md5(f"{session_id}{school_code}".encode()).hexdigest()[:8].upper()

    report_status = f"Completed ({reports_done}/{total_students})" if reports_done else "In Progress"
    delivery_status = f"Completed ({delivered}/{total_students})" if delivered else "In Progress"

    env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))
    template = env.get_template("compliance_template.html")

    html_content = template.render(
        school_name=school_name,
        school_code=school_code,
        school_city=school_city,
        school_board=school_board,
        session_date=session_date_str,
        session_date_short=session_date_short,
        counsellor_name=counsellor_name or "CareerNeeti Counsellor",
        counsellor_certification=counsellor_certification,
        classes_assessed=classes_assessed,
        total_students=total_students,
        report_status=report_status,
        delivery_status=delivery_status,
        consent_count=consent_count,
        ref_number=ref_number,
    )

    output_dir = OUTPUT_DIR / f"session_{session_id}"
    output_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = output_dir / f"compliance_certificate_{school_code}_{session_id}.pdf"

    HTML(string=html_content, base_url=str(TEMPLATES_DIR)).write_pdf(str(pdf_path))
    logger.info(f"Compliance certificate generated: {pdf_path}")
    return pdf_path
