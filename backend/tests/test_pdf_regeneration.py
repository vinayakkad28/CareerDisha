"""A delivered report must survive the filesystem it was written to.

OUTPUT_DIR is /tmp/output on the hosted free plan, which is wiped on every
deploy and every idle recycle, while the absolute path lives on in the database.
So the row said "here is your PDF" and pointed at a file that no longer existed,
and /api/d2c/pdf/{token} answered a permanent 404 — for a report whose full
content was sitting in the database the whole time.

Everything generate_student_pdf needs is a persisted column, so the fix is to
re-render on a miss. No LLM call, no object storage, no bill.
"""

from pathlib import Path

import pytest

from models import D2CAssessment, Student


@pytest.fixture()
def free_mode(monkeypatch):
    monkeypatch.setattr("routers.d2c.FREE_REPORTS", True)


def _report_content() -> dict:
    """Enough of the real schema for the template to render."""
    return {
        "riasec_profile": {"summary": "s" * 250},
        "stream_recommendation": {"recommended_stream": "Science (PCM)"},
        "career_matches": [
            {
                "career_name": f"Career {i}",
                "why_it_fits": "w" * 120,
                "education_pathway": "e" * 120,
                "top_colleges": ["IIT Bombay"],
            }
            for i in range(5)
        ],
        "action_plan": {"next_3_months": ["Talk to a teacher", "Shadow a professional"]},
        "parent_section": {
            "title": "अभिभावकों के लिए",
            "recommendation_summary": "p" * 200,
        },
    }


def _delivered_assessment(client, db, tmp_path) -> tuple[D2CAssessment, Path]:
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
        report_content=_report_content(),
        report_status="pdf_ready",
        d2c_assessment_id=assessment.id,
    )
    db.add(student)
    db.commit()

    # A path that looks exactly like a real one and does not exist — precisely
    # the state a redeploy leaves behind.
    stale = tmp_path / "output" / "d2c" / f"D2C-{assessment.id}_Riya_Sharma_report.pdf"
    student.pdf_path = str(stale)
    assessment.pdf_url = str(stale)
    assessment.student_id = student.id
    assessment.status = "report_ready"
    db.commit()
    db.refresh(assessment)
    return assessment, stale


class TestPdfSurvivesAMissingFile:
    def test_download_regenerates_instead_of_404ing(
        self, client, db, tmp_path, free_mode
    ):
        assessment, stale = _delivered_assessment(client, db, tmp_path)
        assert not stale.exists(), "precondition: the file is gone"

        r = client.get(f"/api/d2c/pdf/{assessment.token}")

        assert r.status_code == 200, r.text
        assert r.headers["content-type"] == "application/pdf"
        assert r.content[:4] == b"%PDF"

    def test_the_rebuilt_path_is_written_back(self, client, db, tmp_path, free_mode):
        """A second download must not pay the render cost again."""
        assessment, stale = _delivered_assessment(client, db, tmp_path)

        client.get(f"/api/d2c/pdf/{assessment.token}")
        db.refresh(assessment)

        assert assessment.pdf_url != str(stale)
        assert Path(assessment.pdf_url).exists()

    def test_status_does_not_claim_a_pdf_that_cannot_be_produced(
        self, client, db, tmp_path, free_mode
    ):
        """/status reported pdf_available purely from the stored string.

        It stayed true after the file vanished, so the UI offered a download
        that could only 404. It should reflect what can actually be delivered.
        """
        assessment, _ = _delivered_assessment(client, db, tmp_path)
        r = client.get(f"/api/d2c/status/{assessment.token}")
        assert r.json()["pdf_available"] is True  # regenerable

    def test_no_report_content_is_still_an_honest_404(
        self, client, db, tmp_path, free_mode
    ):
        assessment, _ = _delivered_assessment(client, db, tmp_path)
        student = db.query(Student).filter(Student.id == assessment.student_id).first()
        student.report_content = None
        db.commit()

        r = client.get(f"/api/d2c/pdf/{assessment.token}")
        assert r.status_code == 404
