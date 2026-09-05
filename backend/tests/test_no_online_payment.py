"""There is no online payment path, and nothing can unlock a report without one.

Replaces test_api_payments.py, which guarded a real production hole: verify-payment
auto-approved any order id beginning "mock_", and because the razorpay package was
missing from requirements, create-order always minted exactly such an id — so two
unauthenticated POSTs produced a paid report for zero rupees.

Those specific tests are now meaningless: fees are collected offline at the school
and the Razorpay surface is deleted. The *guarantee* they encoded is not, and it is
asserted here instead — no request body can flip an assessment to unlocked, and the
old routes are genuinely gone rather than silently re-registered under another name.
"""

import pytest

from models import D2CAssessment


def _assessment(client) -> str:
    return client.post("/api/d2c/start", json={"student_name": "Riya"}).json()["token"]


class TestThePaymentRoutesAreGone:
    @pytest.mark.parametrize("path", ["create-order", "verify-payment"])
    def test_route_no_longer_exists(self, client, path):
        """404, not 503 — proof of removal rather than a disabled feature flag."""
        token = _assessment(client)
        r = client.post(f"/api/d2c/{path}/{token}", json={})
        assert r.status_code == 404, (
            f"/api/d2c/{path} still answers {r.status_code}; the route was not removed"
        )

    def test_the_razorpay_module_is_gone(self):
        with pytest.raises(ModuleNotFoundError):
            __import__("services.razorpay_service")

    def test_no_payment_config_remains(self):
        import config

        for name in ("ENABLE_PAYMENTS", "RAZORPAY_KEY_ID", "RAZORPAY_CONFIGURED", "D2C_PRICING"):
            assert not hasattr(config, name), f"config still exposes {name}"


class TestNoBodyCanBuyItsWayIn:
    """The invariant the deleted payment tests existed to protect."""

    @pytest.mark.parametrize("payload", [
        {},
        {"razorpay_order_id": "mock_order_abc", "razorpay_payment_id": "mock_pay",
         "razorpay_signature": "x"},
        {"payment_status": "paid"},
        {"access_code_id": 1},
        {"tier": "premium", "amount_inr": 0},
    ])
    def test_a_hopeful_body_never_links_a_session(self, client, db, payload):
        token = _assessment(client)
        for path in ("start", "redeem", "submit"):
            client.post(f"/api/d2c/{path}/{token}", json=payload)

        a = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()
        db.refresh(a)
        assert a.access_code_id is None
        assert a.payment_status == "pending"


class TestTheOfflineFeeModelIsIntact:
    def test_the_school_session_rate_survives(self):
        """PRICE_PER_STUDENT_INR is the offline fee, not online pricing.

        It shares its shape with the deleted D2C_PRICING, and a repo-wide sweep
        for price constants would take counsellor commissions with it.
        """
        from routers.counsellors import PRICE_PER_STUDENT_INR

        assert PRICE_PER_STUDENT_INR == 500

    def test_commission_columns_are_untouched(self):
        """CounsellorCommission shares amount_inr / paid_at / status=="paid" with
        the dormant D2C payment columns. Removing payments must not touch it."""
        from models import CounsellorCommission

        cols = {c.name for c in CounsellorCommission.__table__.columns}
        assert {"amount_inr", "paid_at", "status", "rate_per_student"} <= cols
