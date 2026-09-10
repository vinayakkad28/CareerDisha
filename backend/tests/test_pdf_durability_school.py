"""A delivered school report must survive the filesystem it was written to.

OUTPUT_DIR is /tmp/output on the hosted plan, wiped on every deploy and every
idle recycle, while `student.pdf_path` lives on in the database and
`report_status` stays "pdf_ready". Two consequences, both silent:

* `GET /students/{id}/pdf` returned 404 for a report whose full content was
  sitting in Postgres the whole time.
* `GET /sessions/{id}/download` returned **HTTP 200 with an empty ZIP**, because
  the loop was `if pdf_path.exists(): zf.write(...)`. A counsellor would hand out
  nothing and never know.

And nothing could rebuild them: `run_pdf_generation` only picks up rows still in
"qa_passed", and these have already moved to "pdf_ready".
"""

import zipfile
from datetime import date
from io import BytesIO
from pathlib import Path

import pytest

from models import School, Session as SessionModel, Student


def _report_content() -> dict:
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
        "action_plan": {"next_3_months": ["Talk to a teacher"]},
        "parent_section": {"title": "अभिभावकों के लिए", "recommendation_summary": "p" * 200},
    }


@pytest.fixture()
def session_with_stale_pdfs(db, tmp_path):
    """A scored session whose PDF files have vanished — i.e. after any redeploy."""
    school = School(name="Pilot School", code="PS1", city="Meerut", contact_phone="9990000001")
    db.add(school)
    db.commit()

    session = SessionModel(school_id=school.id, session_date=date.today(), counsellor_name="V. Kad")
    db.add(session)
    db.commit()

    students = []
    for i in range(3):
        s = Student(
            session_id=session.id,
            student_id_external=f"PS1-{i}",
            name=f"Student {i}",
            class_level=10,
            holland_code="IRA",
            riasec_scores={"R": 60, "I": 80, "A": 70, "S": 40, "E": 50, "C": 30},
            report_content=_report_content(),
            report_status="pdf_ready",
            # A path that looks exactly like a real one and does not exist.
            pdf_path=str(tmp_path / "output" / f"session_{session.id}" / f"PS1-{i}_report.pdf"),
        )
        db.add(s)
        students.append(s)
    db.commit()
    return session, students


class TestIndividualPdfIsRebuilt:
    def test_download_regenerates_instead_of_404ing(
        self, client, db, admin_headers, session_with_stale_pdfs
    ):
        _, students = session_with_stale_pdfs
        assert not Path(students[0].pdf_path).exists(), "precondition: file is gone"

        r = client.get(f"/api/students/{students[0].id}/pdf", headers=admin_headers)

        assert r.status_code == 200, r.text
        assert r.content[:4] == b"%PDF"

    def test_no_report_content_is_still_an_honest_404(
        self, client, db, admin_headers, session_with_stale_pdfs
    ):
        _, students = session_with_stale_pdfs
        students[0].report_content = None
        db.commit()

        r = client.get(f"/api/students/{students[0].id}/pdf", headers=admin_headers)
        assert r.status_code == 404


class TestBulkZipNeverShipsShort:
    def test_zip_contains_every_student_after_the_files_vanished(
        self, client, db, admin_headers, session_with_stale_pdfs
    ):
        session, students = session_with_stale_pdfs

        r = client.get(f"/api/sessions/{session.id}/download", headers=admin_headers)

        assert r.status_code == 200, r.text
        names = zipfile.ZipFile(BytesIO(r.content)).namelist()
        assert len(names) == len(students), (
            f"zip has {len(names)} of {len(students)} reports — this is the "
            "silent-short-archive bug"
        )

    def test_refuses_rather_than_shipping_an_incomplete_cohort(
        self, client, db, admin_headers, session_with_stale_pdfs
    ):
        """One unrebuildable student must fail the whole download, loudly."""
        session, students = session_with_stale_pdfs
        students[1].report_content = None
        db.commit()

        r = client.get(f"/api/sessions/{session.id}/download", headers=admin_headers)

        assert r.status_code == 409, (
            f"expected a refusal, got {r.status_code} — a partial ZIP would be "
            "handed out as if it were the whole cohort"
        )
        assert "incomplete" in r.json()["detail"].lower()


def test_pdf_generation_assigns_the_survey_token(db):
    """The feedback, NPS and outcome forms authenticate on report_token.

    Removing the web report took the QR code with it, and the token assignment
    went with the QR — silently disabling all three parent-facing forms, since
    nothing else in the codebase ever writes that column.
    """
    import inspect

    from tasks.batch_processor import run_pdf_generation

    src = inspect.getsource(run_pdf_generation)
    assert "student.report_token = uuid.uuid4().hex" in src, (
        "nothing assigns report_token any more; the parent survey links are dead"
    )
