"""A report held for QA must not leak out of a side door.

Found by running the real flow end to end: the pipeline correctly flagged a
report and set status "qa_flagged", and the PDF downloaded anyway with HTTP 200.
On-demand PDF regeneration rebuilds from `report_content`, which exists the
moment the model returns — so the hold applied to the delivery the pipeline
would have made, and not to the customer simply asking again.

The companion concern is the opposite failure: blocking delivery for advisory
`[WARNING]` flags, which left customers polling a spinner forever with no route
out. Both directions are asserted here.
"""

import pytest

from models import D2CAssessment, Student


@pytest.fixture()
def free_mode(monkeypatch):
    monkeypatch.setattr("routers.d2c.FREE_REPORTS", True)


def _assessment_with_status(client, db, report_status: str) -> D2CAssessment:
    token = client.post("/api/d2c/start", json={"student_name": "Riya"}).json()["token"]
    assessment = db.query(D2CAssessment).filter(D2CAssessment.token == token).first()

    from routers.d2c import get_or_create_d2c_session

    session = get_or_create_d2c_session(db)
    db.commit()

    student = Student(
        session_id=session.id,
        student_id_external=f"D2C-{assessment.id}",
        name="Riya Sharma",
        class_level=10,
        holland_code="IRA",
        riasec_scores={"R": 60, "I": 80, "A": 70, "S": 40, "E": 50, "C": 30},
        report_content={"riasec_profile": {"summary": "s" * 200}},
        report_status=report_status,
        d2c_assessment_id=assessment.id,
    )
    db.add(student)
    db.commit()

    assessment.student_id = student.id
    db.commit()
    db.refresh(assessment)
    return assessment


class TestAHeldReportIsNotDeliverable:
    def test_pdf_is_refused_while_flagged(self, client, db, free_mode):
        a = _assessment_with_status(client, db, "qa_flagged")
        r = client.get(f"/api/d2c/pdf/{a.token}")
        assert r.status_code == 409, (
            f"a QA-held report was downloadable ({r.status_code}) — the "
            "regeneration path bypassed the hold"
        )

    def test_report_json_is_refused_while_flagged(self, client, db, free_mode):
        a = _assessment_with_status(client, db, "qa_flagged")
        assert client.get(f"/api/d2c/report/{a.token}").status_code == 409

    def test_public_web_report_is_refused_while_flagged(self, client, db, free_mode):
        a = _assessment_with_status(client, db, "qa_flagged")
        assert client.get(f"/api/reports/{a.token}").status_code == 409

    def test_the_refusal_explains_itself(self, client, db, free_mode):
        a = _assessment_with_status(client, db, "qa_flagged")
        detail = client.get(f"/api/d2c/report/{a.token}").json()["detail"]
        assert "quality check" in detail.lower()


class TestAPassedReportIsDeliverable:
    @pytest.mark.parametrize("status", ["qa_passed", "pdf_ready", "delivered"])
    def test_cleared_statuses_are_served(self, client, db, free_mode, status):
        a = _assessment_with_status(client, db, status)
        assert client.get(f"/api/d2c/report/{a.token}").status_code == 200


class TestAdvisoryFlagsDoNotBlock:
    def test_warning_only_reports_are_not_held(self):
        """The school pipeline has always drawn this line; D2C was the outlier.

        Holding a finished report because `personal_note` is 190 characters
        instead of 200 is not quality control, it is a dead end with no
        notification and no way for the customer to escape it.
        """
        import inspect

        from routers.d2c import _generate_d2c_report

        src = inspect.getsource(_generate_d2c_report)
        assert "hard_flags" in src, "D2C blocks on advisory flags again"
        assert "if flags:\n            student.report_status" not in src

    def test_unlisted_college_is_advisory_not_blocking(self):
        """The whitelist cannot cover every real Indian institution.

        A live run held a good report because "Sir J.J. College of Architecture,
        Mumbai" is real but absent from the 541-entry list. Blocking on that
        fails more honest reports than it catches invented ones.
        """
        import inspect

        from engines.qa_checker import validate_report

        src = inspect.getsource(validate_report)
        assert '"[WARNING] College' in src or "[WARNING] College" in src
