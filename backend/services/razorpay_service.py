"""Razorpay payment service for D2C assessments."""
import logging
import hashlib
import hmac
from config import RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET

logger = logging.getLogger(__name__)


def create_razorpay_order(amount_paise: int, receipt: str, notes: dict = None) -> dict:
    """Create a Razorpay order."""
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise ValueError("Razorpay not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.")

    import razorpay
    client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    order = client.order.create({
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt,
        "notes": notes or {},
    })
    order["key_id"] = RAZORPAY_KEY_ID
    return order


def verify_razorpay_payment(order_id: str, payment_id: str, signature: str) -> bool:
    """Verify Razorpay payment signature."""
    if not RAZORPAY_KEY_SECRET:
        raise ValueError("Razorpay not configured.")

    import razorpay
    client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    try:
        client.utility.verify_payment_signature({
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
        })
        return True
    except razorpay.errors.SignatureVerificationError:
        return False
