"""Free mode gives the report away; it must not become a payment bypass.

Two halves, and the second matters more than the first.

The first half proves the beta works at all: with FREE_REPORTS on, a report is
reachable without anyone paying.

The second half proves the switch is real. The original production hole was a
"mock" order id that verify-payment auto-approved, so two unauthenticated POSTs
produced a paid report for zero rupees (see test_api_payments.py). Free mode is
deliberately a separate flag rather than a hole in the payment path, and these
tests exist to keep it that way: with FREE_REPORTS off, every gate must still
answer 402.
"""

import pytest

from models import D2CAssessment, Student


def _submitted_assessment(client, db) -> D2CAssessment:
    """An assessment with a scored student and report content attached.

    Built directly rather than by walking all 110 questions through the API —
    these tests are about the gates, not about scoring.
    """
    token = client.post("/api/d2c/start", json={"student_name": "Aarav"}).json()["token"]
    assessment = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()

    from routers.d2c import get_or_create_d2c_session

    session = get_or_create_d2c_session(db)
    db.commit()

    student = Student(
        session_id=session.id,
        student_id_external=f"D2C-{assessment.id}",
        name="Aarav",
        class_level=10,
        holland_code="IRA",
        riasec_scores={"R": 60, "I": 80, "A": 70, "S": 40, "E": 50, "C": 30},
        report_content={"riasec_profile": {"summary": "x" * 200}},
        report_status="pdf_ready",
        d2c_assessment_id=assessment.id,
    )
    db.add(student)
    db.commit()

    assessment.student_id = student.id
    assessment.status = "report_ready"
    db.commit()
    db.refresh(assessment)
    return assessment


@pytest.fixture()
def free_mode(monkeypatch):
    monkeypatch.setattr("routers.d2c.FREE_REPORTS", True)


@pytest.fixture()
def paid_mode(monkeypatch):
    monkeypatch.setattr("routers.d2c.FREE_REPORTS", False)


class TestFreeModeUnlocksTheReport:
    def test_report_json_is_served_without_payment(self, client, db, free_mode):
        a = _submitted_assessment(client, db)
        r = client.get(f"/api/d2c/report/{a.token}")
        assert r.status_code == 200, r.text
        assert r.json()["report"]

    def test_public_web_report_is_served_without_payment(self, client, db, free_mode):
        a = _submitted_assessment(client, db)
        r = client.get(f"/api/reports/{a.token}")
        assert r.status_code == 200, r.text

    def test_preview_is_not_marked_locked(self, client, db, free_mode):
        a = _submitted_assessment(client, db)
        r = client.get(f"/api/d2c/preview/{a.token}")
        assert r.status_code == 200, r.text
        assert r.json()["report_locked"] is False

    def test_payment_status_is_still_honestly_pending(self, client, db, free_mode):
        """Free mode must not forge a payment record.

        Marking the row "paid" would be the easy shortcut and would corrupt the
        only source of truth about whether money was actually received.
        """
        a = _submitted_assessment(client, db)
        client.get(f"/api/d2c/report/{a.token}")
        db.refresh(a)
        assert a.payment_status == "pending"


class TestPaidModeStillRefuses:
    def test_report_json_is_402_without_payment(self, client, db, paid_mode):
        a = _submitted_assessment(client, db)
        assert client.get(f"/api/d2c/report/{a.token}").status_code == 402

    def test_pdf_is_402_without_payment(self, client, db, paid_mode):
        a = _submitted_assessment(client, db)
        assert client.get(f"/api/d2c/pdf/{a.token}").status_code == 402

    def test_public_web_report_is_402_without_payment(self, client, db, paid_mode):
        a = _submitted_assessment(client, db)
        assert client.get(f"/api/reports/{a.token}").status_code == 402

    def test_preview_is_marked_locked(self, client, db, paid_mode):
        a = _submitted_assessment(client, db)
        r = client.get(f"/api/d2c/preview/{a.token}")
        assert r.json()["report_locked"] is True
