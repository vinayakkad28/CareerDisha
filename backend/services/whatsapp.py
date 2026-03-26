"""WhatsApp delivery service for sending career reports to parents.

Supports two providers:
- Meta Cloud API (WhatsApp Business API) — preferred, lower cost
- Twilio WhatsApp — fallback
"""

import logging
import re
import time
import httpx
from pathlib import Path
from typing import Optional

from config import (
    WHATSAPP_PROVIDER, META_WHATSAPP_TOKEN, META_PHONE_NUMBER_ID,
    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM,
)

logger = logging.getLogger(__name__)


def normalize_phone(phone: str) -> str:
    """Normalize Indian phone number to international format (91XXXXXXXXXX)."""
    phone = re.sub(r'[^0-9]', '', phone)
    if phone.startswith('0'):
        phone = phone[1:]
    if len(phone) == 10:
        phone = '91' + phone
    if not phone.startswith('91') or len(phone) != 12:
        raise ValueError(f"Invalid Indian phone number: {phone}")
    return phone


def is_whatsapp_configured() -> bool:
    """Check if any WhatsApp provider is configured."""
    if WHATSAPP_PROVIDER == "meta" and META_WHATSAPP_TOKEN and META_PHONE_NUMBER_ID:
        return True
    if WHATSAPP_PROVIDER == "twilio" and TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
        return True
    return False


async def send_pdf_meta(phone: str, pdf_path: str, student_name: str, school_name: str) -> dict:
    """Send PDF via Meta Cloud API."""
    phone = normalize_phone(phone)
    pdf_file = Path(pdf_path)
    if not pdf_file.exists():
        return {"success": False, "error": f"PDF not found: {pdf_path}"}

    base_url = f"https://graph.facebook.com/v18.0/{META_PHONE_NUMBER_ID}"
    headers = {"Authorization": f"Bearer {META_WHATSAPP_TOKEN}"}

    async with httpx.AsyncClient() as client:
        # Step 1: Upload media
        with open(pdf_file, "rb") as f:
            upload_resp = await client.post(
                f"{base_url}/media",
                headers=headers,
                files={"file": (pdf_file.name, f, "application/pdf")},
                data={"messaging_product": "whatsapp"},
            )
        if upload_resp.status_code != 200:
            return {"success": False, "error": f"Media upload failed: {upload_resp.text}"}
        media_id = upload_resp.json().get("id")

        # Step 2: Send document message
        message = {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "document",
            "document": {
                "id": media_id,
                "caption": f"Namaste! {student_name}'s CareerDisha Career Assessment Report from {school_name} is ready. For questions, contact your school counsellor. — CareerDisha",
                "filename": f"{student_name}_Career_Report.pdf",
            },
        }
        send_resp = await client.post(
            f"{base_url}/messages",
            headers={**headers, "Content-Type": "application/json"},
            json=message,
        )
        if send_resp.status_code in (200, 201):
            msg_id = send_resp.json().get("messages", [{}])[0].get("id", "")
            return {"success": True, "message_id": msg_id}
        return {"success": False, "error": f"Send failed: {send_resp.text}"}


async def send_pdf_twilio(phone: str, pdf_path: str, student_name: str, school_name: str) -> dict:
    """Send PDF via Twilio WhatsApp."""
    phone = normalize_phone(phone)
    pdf_file = Path(pdf_path)
    if not pdf_file.exists():
        return {"success": False, "error": f"PDF not found: {pdf_path}"}

    # Twilio requires a publicly accessible URL for media — for now, return manual instruction
    # In production, upload to S3/cloud storage first
    return {
        "success": False,
        "error": "Twilio WhatsApp requires publicly hosted media URLs. Upload PDFs to cloud storage first.",
    }


async def send_pdf(phone: str, pdf_path: str, student_name: str, school_name: str,
                   max_retries: int = 3, retry_delay: float = 5.0) -> dict:
    """Send PDF report via configured WhatsApp provider with retry on failure."""
    if not is_whatsapp_configured():
        return {"success": False, "error": "WhatsApp not configured. Set WHATSAPP_PROVIDER in .env"}

    last_result = {"success": False, "error": "Unknown error"}
    for attempt in range(1, max_retries + 1):
        try:
            if WHATSAPP_PROVIDER == "meta":
                result = await send_pdf_meta(phone, pdf_path, student_name, school_name)
            elif WHATSAPP_PROVIDER == "twilio":
                result = await send_pdf_twilio(phone, pdf_path, student_name, school_name)
            else:
                return {"success": False, "error": f"Unknown provider: {WHATSAPP_PROVIDER}"}

            if result["success"]:
                return result

            last_result = result
            if attempt < max_retries:
                logger.warning(f"WhatsApp send attempt {attempt}/{max_retries} failed for {phone}: {result.get('error')}. Retrying in {retry_delay}s...")
                time.sleep(retry_delay)
        except Exception as e:
            last_result = {"success": False, "error": str(e)}
            if attempt < max_retries:
                logger.warning(f"WhatsApp send attempt {attempt}/{max_retries} exception for {phone}: {e}. Retrying in {retry_delay}s...")
                time.sleep(retry_delay)
            else:
                logger.error(f"WhatsApp send all retries exhausted for {phone}: {e}")

    return last_result


async def send_survey_message(phone: str, student_name: str, feedback_url: str) -> dict:
    """Send a post-delivery satisfaction survey link via WhatsApp."""
    if not is_whatsapp_configured():
        return {"success": False, "error": "WhatsApp not configured"}

    text = (
        f"Namaste! 🙏\n\n"
        f"We hope {student_name}'s CareerDisha report has been helpful.\n\n"
        f"It would mean a lot if you could share your feedback (2 minutes):\n"
        f"👉 {feedback_url}\n\n"
        f"Your response helps us improve guidance for thousands of students. Thank you! 🌟\n"
        f"— CareerDisha Team"
    )

    if WHATSAPP_PROVIDER == "meta" and META_WHATSAPP_TOKEN and META_PHONE_NUMBER_ID:
        normalized = normalize_phone(phone)
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://graph.facebook.com/v18.0/{META_PHONE_NUMBER_ID}/messages",
                headers={
                    "Authorization": f"Bearer {META_WHATSAPP_TOKEN}",
                    "Content-Type": "application/json",
                },
                json={
                    "messaging_product": "whatsapp",
                    "to": normalized,
                    "type": "text",
                    "text": {"body": text},
                },
            )
        if resp.status_code in (200, 201):
            return {"success": True}
        return {"success": False, "error": resp.text}

    return {"success": False, "error": f"Provider {WHATSAPP_PROVIDER} not supported for text messages"}


async def send_bulk(students_data: list, school_name: str) -> dict:
    """Send PDFs to multiple students with rate limiting (1/sec for WhatsApp)."""
    sent = 0
    failed = 0
    errors = []

    for item in students_data:
        result = await send_pdf(
            item["phone"], item["pdf_path"], item["name"], school_name
        )
        if result["success"]:
            sent += 1
        else:
            failed += 1
            errors.append({"student": item["name"], "error": result.get("error", "Unknown")})
        time.sleep(1)  # WhatsApp rate limit: ~1 msg/sec for business API

    return {"sent": sent, "failed": failed, "total": len(students_data), "errors": errors}
