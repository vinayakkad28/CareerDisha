"""School-issued codes gate the full online report, and carry its consent.

Two problems, one mechanism.

Commercially: the site was giving away, free, the identical report parents were
being charged ₹500 for at a school session. One parent checking their phone
during the pitch ends the pilot and the principal relationship with it.

For consent: the online flow asserted `consent_obtained=True` with method
"digital" — the same label a genuine OTP verification writes — for a child who
typed their own name. Because every code is issued against a Session, and a
school session is where a signed paper circular is collected, redeeming one
inherits real evidenced consent instead of inventing it.
"""

from datetime import date, timedelta

import pytest

from models import AccessCode, AuditLog, D2CAssessment, School, Session as SessionModel, Student
from utils.time import utcnow


@pytest.fixture()
def paid_mode(monkeypatch):
    """The posture the pilot runs in: the report is not free to the public."""
    monkeypatch.setattr("routers.d2c.FREE_REPORTS", False)


@pytest.fixture()
def school_session(db):
    school = School(name="Pilot School", code="PS1", city="Meerut", contact_phone="9990000001")
    db.add(school)
    db.commit()
    session = SessionModel(school_id=school.id, session_date=date.today())
    db.add(session)
    db.commit()
    return session


def _code(db, session, **kw) -> AccessCode:
    c = AccessCode(code=kw.pop("code", "ABCD2345"), session_id=session.id, **kw)
    db.add(c)
    db.commit()
    return c


def _assessment(client) -> str:
    return client.post("/api/d2c/start", json={"student_name": "Riya"}).json()["token"]


class TestRedemption:
    def test_a_valid_code_unlocks_the_report(self, client, db, school_session, paid_mode):
        _code(db, school_session)
        token = _assessment(client)

        r = client.post(f"/api/d2c/redeem/{token}", json={"code": "ABCD2345"})

        assert r.status_code == 200, r.text
        assert r.json()["status"] == "redeemed"
        a = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()
        db.refresh(a)
        assert a.access_code_id is not None

    def test_codes_are_case_insensitive_and_trimmed(self, client, db, school_session, paid_mode):
        """Parents type these off a printed circular."""
        _code(db, school_session)
        token = _assessment(client)
        r = client.post(f"/api/d2c/redeem/{token}", json={"code": "  abcd2345 "})
        assert r.status_code == 200, r.text

    def test_an_unknown_code_is_refused(self, client, school_session, paid_mode):
        token = _assessment(client)
        r = client.post(f"/api/d2c/redeem/{token}", json={"code": "ZZZZ9999"})
        assert r.status_code == 404

    def test_an_already_used_code_is_refused(self, client, db, school_session, paid_mode):
        _code(db, school_session, max_uses=1, times_used=1)
        token = _assessment(client)
        r = client.post(f"/api/d2c/redeem/{token}", json={"code": "ABCD2345"})
        assert r.status_code == 409
        assert "already been used" in r.json()["detail"]

    def test_an_expired_code_is_refused(self, client, db, school_session, paid_mode):
        _code(db, school_session, expires_at=utcnow() - timedelta(days=1))
        token = _assessment(client)
        r = client.post(f"/api/d2c/redeem/{token}", json={"code": "ABCD2345"})
        assert r.status_code == 409
        assert "expired" in r.json()["detail"]

    def test_a_deactivated_code_is_refused(self, client, db, school_session, paid_mode):
        _code(db, school_session, is_active=False)
        token = _assessment(client)
        r = client.post(f"/api/d2c/redeem/{token}", json={"code": "ABCD2345"})
        assert r.status_code == 409

    def test_redemption_is_audited(self, client, db, school_session, paid_mode):
        """Entitlement and the consent it carries must be traceable."""
        _code(db, school_session)
        token = _assessment(client)
        client.post(f"/api/d2c/redeem/{token}", json={"code": "ABCD2345"})

        rows = db.query(AuditLog).filter(AuditLog.action == "access_code_redeemed").all()
        assert len(rows) == 1
        assert "ABCD2345" in rows[0].detail


class TestTheGate:
    def test_without_a_code_the_report_stays_locked(self, client, db, school_session, paid_mode):
        """This is the whole point: no free public copy of the ₹500 report."""
        token = _assessment(client)
        a = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()
        r = client.get(f"/api/d2c/preview/{a.token}")
        # Preview 400s before submission; the flag is what matters here.
        from routers.d2c import report_is_unlocked

        assert report_is_unlocked(a) is False

    def test_with_a_redeemed_code_it_is_unlocked(self, client, db, school_session, paid_mode):
        _code(db, school_session)
        token = _assessment(client)
        client.post(f"/api/d2c/redeem/{token}", json={"code": "ABCD2345"})

        a = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()
        db.refresh(a)
        from routers.d2c import report_is_unlocked

        assert report_is_unlocked(a) is True

    def test_a_code_does_not_forge_a_payment(self, client, db, school_session, paid_mode):
        """payment_status stays an honest record of money received."""
        _code(db, school_session)
        token = _assessment(client)
        client.post(f"/api/d2c/redeem/{token}", json={"code": "ABCD2345"})

        a = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()
        db.refresh(a)
        assert a.payment_status == "pending"


class TestConsentIsInheritedNeverInvented:
    def test_submitting_without_a_code_records_no_consent(self, db):
        from routers.d2c import _inherited_consent

        a = D2CAssessment(token="t1", access_code_id=None)
        assert _inherited_consent(db, a)["consent_obtained"] is False

    def test_a_redeemed_code_carries_the_sessions_paper_consent(self, db, school_session):
        from routers.d2c import _inherited_consent

        code = _code(db, school_session)
        a = D2CAssessment(token="t2", access_code_id=code.id)
        got = _inherited_consent(db, a)
        assert got["consent_obtained"] is True
        assert got["consent_method"] == "paper_form"

    def test_consent_is_never_labelled_digital_without_an_otp(self, db, school_session):
        """'digital' is what verify_consent_otp writes. Reusing it for a
        fabricated record made the two indistinguishable in the database."""
        from routers.d2c import _inherited_consent

        code = _code(db, school_session)
        for assessment in (
            D2CAssessment(token="t3", access_code_id=None),
            D2CAssessment(token="t4", access_code_id=code.id),
        ):
            assert _inherited_consent(db, assessment).get("consent_method") != "digital"

    def test_the_submit_handler_does_not_hardcode_consent(self):
        import inspect

        from routers.d2c import submit_assessment

        src = inspect.getsource(submit_assessment)
        assert "consent_obtained=True" not in src, "consent is being fabricated again"


class TestIssuingCodes:
    def test_admin_can_mint_codes_for_a_session(self, client, db, admin_headers, school_session):
        r = client.post(
            f"/api/sessions/{school_session.id}/access-codes",
            json={"count": 5}, headers=admin_headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["issued"] == 5
        assert len(set(body["codes"])) == 5, "codes must be unique"

    def test_codes_avoid_ambiguous_characters(self, client, db, admin_headers, school_session):
        """They are read off paper and typed by a parent."""
        r = client.post(
            f"/api/sessions/{school_session.id}/access-codes",
            json={"count": 20}, headers=admin_headers,
        )
        for code in r.json()["codes"]:
            assert not set(code) & set("O0I1"), f"{code} contains an ambiguous character"

    def test_issuing_is_audited(self, client, db, admin_headers, school_session):
        client.post(
            f"/api/sessions/{school_session.id}/access-codes",
            json={"count": 3}, headers=admin_headers,
        )
        rows = db.query(AuditLog).filter(AuditLog.action == "access_codes_issued").all()
        assert len(rows) == 1

    def test_refuses_an_absurd_batch(self, client, admin_headers, school_session):
        r = client.post(
            f"/api/sessions/{school_session.id}/access-codes",
            json={"count": 5000}, headers=admin_headers,
        )
        assert r.status_code == 400

    def test_empty_session_without_an_explicit_count_is_an_error(
        self, client, admin_headers, school_session
    ):
        r = client.post(
            f"/api/sessions/{school_session.id}/access-codes",
            json={}, headers=admin_headers,
        )
        assert r.status_code == 400
        assert "roster" in r.json()["detail"].lower()
