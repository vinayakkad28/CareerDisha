"""Email delivery service for CareerDisha reports."""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path

from config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL

logger = logging.getLogger(__name__)


def send_report_email(to_email: str, student_name: str, pdf_path: str, holland_code: str = "", stream: str = "") -> bool:
    """Send career report PDF via email."""
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.warning("SMTP not configured — skipping email delivery")
        return False

    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_FROM_EMAIL or SMTP_USER
        msg["To"] = to_email
        msg["Subject"] = f"CareerDisha Career Report for {student_name}"

        body = f"""Namaste!

Your child {student_name}'s personalized AI Career Assessment Report from CareerDisha is ready.

Key Highlights:
- Holland Code: {holland_code}
- Recommended Stream: {stream}
- 5 personalized career recommendations with colleges, salaries, and action plans
- Bilingual parent section (Hindi + English)

Please find the detailed report attached as a PDF.

For questions or follow-up counselling, reply to this email or visit www.careerdisha.com

Best regards,
CareerDisha Team
AI-Powered Career Counselling for Indian Schools
www.careerdisha.com
"""
        msg.attach(MIMEText(body, "plain"))

        # Attach PDF
        pdf_file = Path(pdf_path)
        if pdf_file.exists():
            with open(pdf_file, "rb") as f:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(f.read())
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", f"attachment; filename=CareerDisha_Report_{student_name.replace(' ', '_')}.pdf")
            msg.attach(part)

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(f"Report email sent to {to_email} for {student_name}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False
