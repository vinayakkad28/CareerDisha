"""The paid D2C funnel must never hand out a report for free.

Guards the bypass found in production: verify-payment auto-approved any order id
starting with "mock_", and because the razorpay package was missing from
requirements.txt, create-order ALWAYS minted exactly such an id. Two
unauthenticated POSTs produced a paid Rs 2,999 report for zero rupees.
"""

import pytest


def _start_assessment(client):
    r = client.post("/api/d2c/start",
                    json={"student_name": "Test Student", "class_level": 10})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _payment_status(client, token):
    return client.get(f"/api/d2c/status/{token}").json()["payment_status"]


class TestPaymentsDisabled:
    """ENABLE_PAYMENTS defaults to false, and both endpoints must refuse.

    Refusing outright is the point: with no credentials the old code degraded to
    a mock order that verification then accepted.
    """

    def test_create_order_is_503(self, client):
        token = _start_assessment(client)
        r = client.post(f"/api/d2c/create-order/{token}", json={"tier": "basic"})
        assert r.status_code == 503

    def test_verify_payment_is_503(self, client):
        token = _start_assessment(client)
        r = client.post(f"/api/d2c/verify-payment/{token}", json={})
        assert r.status_code == 503

    def test_mock_query_param_does_nothing(self, client):
        """?mock=true was the original documented bypass."""
        token = _start_assessment(client)
        r = client.post(f"/api/d2c/verify-payment/{token}?mock=true", json={})
        assert r.status_code == 503
        assert _payment_status(client, token) == "pending"

    def test_assessment_never_becomes_paid(self, client):
        token = _start_assessment(client)
        for payload in ({}, {"mock": True},
                        {"razorpay_order_id": "mock_order_abc",
                         "razorpay_payment_id": "pay_x",
                         "razorpay_signature": "sig"}):
            client.post(f"/api/d2c/verify-payment/{token}", json=payload)
        assert _payment_status(client, token) == "pending"


class TestPaymentsEnabled:
    """With payments on, only a genuine Razorpay signature may pass."""

    @pytest.fixture(autouse=True)
    def _enable(self, monkeypatch):
        monkeypatch.setattr("routers.d2c.ENABLE_PAYMENTS", True)

    def test_empty_body_is_rejected(self, client):
        token = _start_assessment(client)
        r = client.post(f"/api/d2c/verify-payment/{token}", json={})
        assert r.status_code == 400
        assert _payment_status(client, token) == "pending"

    def test_forged_signature_is_rejected(self, client):
        token = _start_assessment(client)
        r = client.post(f"/api/d2c/verify-payment/{token}",
                        json={"razorpay_order_id": "order_FAKE",
                              "razorpay_payment_id": "pay_FAKE",
                              "razorpay_signature": "deadbeef"})
        assert r.status_code == 400
        assert _payment_status(client, token) == "pending"

    def test_mock_prefixed_order_id_is_rejected(self, client):
        """The exact shape the old code auto-approved."""
        token = _start_assessment(client)
        r = client.post(f"/api/d2c/verify-payment/{token}",
                        json={"razorpay_order_id": "mock_order_deadbeef",
                              "razorpay_payment_id": "mock_pay_1",
                              "razorpay_signature": "mock_signature"})
        assert r.status_code == 400
        assert _payment_status(client, token) == "pending"

    def test_order_id_from_another_assessment_is_rejected(self, client, db):
        """Replay guard: a valid signature must belong to THIS assessment."""
        from models import D2CAssessment

        victim = _start_assessment(client)
        attacker = _start_assessment(client)

        # Give the victim a plausible order id, then try to reuse it elsewhere.
        row = db.query(D2CAssessment).filter(D2CAssessment.token == victim).first()
        row.razorpay_order_id = "order_BELONGS_TO_VICTIM"
        db.commit()

        r = client.post(f"/api/d2c/verify-payment/{attacker}",
                        json={"razorpay_order_id": "order_BELONGS_TO_VICTIM",
                              "razorpay_payment_id": "pay_x",
                              "razorpay_signature": "sig"})
        assert r.status_code == 400
        assert _payment_status(client, attacker) == "pending"


class TestAmountUnits:
    """create-order must never return a bare, ambiguous `amount`.

    The client divided `amount` by 100 assuming paise while the backend sent
    rupees, so a Rs 499 tier displayed — and would have charged — Rs 4.99.
    """

    def test_response_carries_both_units_explicitly(self, client, monkeypatch):
        from config import D2C_PRICING

        monkeypatch.setattr("routers.d2c.ENABLE_PAYMENTS", True)

        captured = {}

        def fake_order(amount_paise, receipt, notes=None):
            captured["amount_paise"] = amount_paise
            return {"id": "order_REAL123", "key_id": "rzp_test_key"}

        monkeypatch.setattr("services.razorpay_service.create_razorpay_order", fake_order)

        token = _start_assessment(client)
        r = client.post(f"/api/d2c/create-order/{token}", json={"tier": "basic"})
        assert r.status_code == 200, r.text
        body = r.json()

        assert "amount" not in body, "ambiguous bare `amount` is back"
        assert body["amount_inr"] == D2C_PRICING["basic"]
        assert body["amount_paise"] == D2C_PRICING["basic"] * 100
        # Razorpay is charged in paise, not rupees.
        assert captured["amount_paise"] == D2C_PRICING["basic"] * 100

    def test_returns_razorpay_key_not_key_id(self, client, monkeypatch):
        """The client gates the real checkout on `razorpay_key`.

        The backend returned `key_id`, so the check was always false and every
        customer fell through to the mock screen.
        """
        monkeypatch.setattr("routers.d2c.ENABLE_PAYMENTS", True)
        monkeypatch.setattr("services.razorpay_service.create_razorpay_order",
                            lambda a, r, notes=None: {"id": "order_X", "key_id": "rzp_live_abc"})

        token = _start_assessment(client)
        body = client.post(f"/api/d2c/create-order/{token}", json={"tier": "basic"}).json()
        assert body.get("razorpay_key") == "rzp_live_abc"
