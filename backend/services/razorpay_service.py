"""Razorpay payment service for D2C assessments."""
import logging

from config import RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET

logger = logging.getLogger(__name__)


class PaymentsNotConfigured(RuntimeError):
    """Razorpay credentials or SDK are unavailable.

    Distinct from every other failure so callers can narrow their handling.
    The router used to catch bare `Exception` here and substitute a free "mock"
    order, which meant a network blip or an expired key silently downgraded a
    real payment into a free report.
    """


def _client():
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise PaymentsNotConfigured(
            "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to accept payments."
        )
    try:
        import razorpay
    except ModuleNotFoundError as e:  # pragma: no cover - depends on install
        raise PaymentsNotConfigured(
            "The 'razorpay' package is not installed; add it to requirements.txt."
        ) from e
    return razorpay, razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


def create_razorpay_order(amount_paise: int, receipt: str, notes: dict = None) -> dict:
    """Create a Razorpay order. Raises PaymentsNotConfigured or the SDK's own errors."""
    _razorpay, client = _client()
    order = client.order.create({
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt,
        "notes": notes or {},
    })
    order["key_id"] = RAZORPAY_KEY_ID
    return order


def verify_razorpay_payment(order_id: str, payment_id: str, signature: str) -> bool:
    """Verify a Razorpay payment signature (HMAC, performed by the SDK)."""
    razorpay, client = _client()
    if not (order_id and payment_id and signature):
        return False
    try:
        client.utility.verify_payment_signature({
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
        })
        return True
    except razorpay.errors.SignatureVerificationError:
        return False
