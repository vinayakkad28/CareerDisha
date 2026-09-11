"""The counsellor's whole pipeline, with the LLM stubbed out.

scored -> generate -> QA -> PDF -> ZIP, which is the path a school visit
actually depends on and the one the owner reported as broken. Every stage here
was verified by hand against a running server; this pins it so CI holds it.

The LLM is stubbed rather than mocked away: the real generate_single_report,
qa_checker and WeasyPrint all run. That costs a couple of seconds and is the
whole point — the two production PDF failures were font and import problems
inside WeasyPrint that no mock would have reached.
"""

from datetime import date
from pathlib import Path

import pytest

from models import School, Session as SessionModel, Student


def _full_report() -> dict:
    """A report complete enough to pass QA, including the [WARNING] sections."""
    return {
        "riasec_profile": {"summary": "You lean investigative and realistic. " * 12},
        "personal_note": "Dear student, " + "this is a long personal note. " * 20,
        "stream_recommendation": {
            "recommended_stream": "Science (PCM)",
            "reasoning": "Strong I and R scores with good maths marks. " * 5,
        },
        "career_matches": [
            {
                "career_name": name,
                "why_it_fits": "It fits because " + "reasons. " * 20,
                "education_pathway": "B.Tech then M.Tech. " * 15,
                "top_colleges": ["IIT Bombay", "NIT Trichy"],
            }
            for name in [
                "Mechanical Engineer", "Data Analyst", "Civil Engineer",
                "Architect", "Product Designer",
            ]
        ],
        "hidden_gems": [
            {"career_name": "Geospatial Analyst", "why_it_fits": "Maps and data. " * 12},
            {"career_name": "Acoustic Engineer", "why_it_fits": "Sound and physics. " * 12},
        ],
        "personality_portrait": {"who_you_are": "You are practical and curious. " * 25},
        "career_deep_dive": {
            "day_in_the_life": "A typical day starts at 9am. " * 12,
            "journey_map": [{"stage": f"Stage {i}", "detail": "d" * 60} for i in range(6)],
        },
        "stream_comparison": {
            "all_streams": [
                {"stream": s, "fit": "medium", "notes": "n" * 60}
                for s in [
                    "Science PCM", "Science PCB", "Commerce with Maths",
                    "Commerce without Maths", "Arts/Humanities",
                ]
            ]
        },
        "financial_roadmap": {
            "top_scholarships": [
                {"name": "NSP Central Sector Scheme", "detail": "d" * 50},
                {"name": "INSPIRE-SHE", "detail": "d" * 50},
                {"name": "Kishore Vaigyanik Protsahan Yojana", "detail": "d" * 50},
            ]
        },
        "confidence_builder": {
            "thirty_day_challenges": [
                f"Challenge {i}: " + "do a small project. " * 5 for i in range(4)
            ]
        },
        "action_plan": {
            "next_3_months": ["Talk to a teacher", "Shadow an engineer", "Start Class 11 maths"],
            "recommended_books": ["Wings of Fire", "Ignited Minds", "The Discovery of India"],
            "recommended_youtube": ["Physics Wallah", "Khan Academy Hindi", "Unacademy"],
            "recommended_websites": ["SWAYAM", "NPTEL", "Coursera"],
        },
        "parent_section": {
            "title": "अभिभावकों के लिए",
            "recommendation_summary": "आपके बच्चे की रुचि विज्ञान में है। " * 12,
            "faqs": [{"q": f"प्रश्न {i}", "a": "उत्तर " * 20} for i in range(3)],
            "conversation_starters": ["बात 1", "बात 2", "बात 3"],
        },
    }


@pytest.fixture()
def stub_llm(monkeypatch):
    """Return a complete report without calling — or paying — a provider."""
    import engines.report_generator as rg

    calls = {"n": 0}

    def fake_generate(self, system_prompt, user_prompt):
        calls["n"] += 1
        assert len(system_prompt) > 100, "the real prompt was not passed through"
        return _full_report(), 0.0

    monkeypatch.setattr(rg.LLMClient, "generate", fake_generate)
    return calls


@pytest.fixture()
def school_visit(db):
    """A scored session: one student with consent, one without."""
    school = School(name="Pilot School", code="PS1", city="Meerut", contact_phone="9990000001")
    db.add(school)
    db.commit()
    session = SessionModel(
        school_id=school.id, session_date=date.today(),
        counsellor_name="V. Kad", status="scored",
    )
    db.add(session)
    db.commit()

    def student(name, ext, consent):
        s = Student(
            session_id=session.id, student_id_external=ext, name=name, class_level=10,
            holland_code="IRA",
            riasec_scores={"R": 60, "I": 80, "A": 70, "S": 40, "E": 50, "C": 30},
            riasec_raw_responses={"Q1": "A"}, report_status="scored",
            consent_obtained=consent, consent_method="paper_form" if consent else "",
            parent_name="Parent", parent_phone="9990000011",
        )
        db.add(s)
        db.commit()
        return s

    return {
        "session": session,
        "consented": student("Riya Sharma", "PS1-001", True),
        "no_consent": student("Amit Verma", "PS1-002", False),
    }


class TestGeneration:
    def test_a_consented_student_gets_a_report(self, db, stub_llm, school_visit):
        from tasks.batch_processor import run_report_generation

        run_report_generation(school_visit["session"].id, provider="google")

        db.expire_all()
        s = db.query(Student).filter(Student.id == school_visit["consented"].id).first()
        assert s.report_status == "report_generated"
        assert s.report_content

    def test_a_student_without_consent_is_refused(self, db, stub_llm, school_visit):
        """DPDP §9: no verifiable parental consent, no processing."""
        from tasks.batch_processor import run_report_generation

        run_report_generation(school_visit["session"].id, provider="google")

        db.expire_all()
        s = db.query(Student).filter(Student.id == school_visit["no_consent"].id).first()
        assert not s.report_content
        assert s.report_status == "scored"
        assert stub_llm["n"] == 1, "the LLM was called for a student without consent"

    def test_a_run_that_produces_nothing_unwedges_the_session(self, db, stub_llm, school_visit):
        """The status used to be left at "generating" — the value the route sets
        before queueing the task. The page polls while a session is generating,
        so it span forever, and /generate refused a retry with 409 for half an
        hour. It must land somewhere a counsellor can act on."""
        from tasks.batch_processor import run_report_generation

        session = school_visit["session"]
        for s in db.query(Student).filter(Student.session_id == session.id):
            s.consent_obtained = False
        session.status = "generating"
        db.commit()

        run_report_generation(session.id, provider="google")

        db.expire_all()
        session = db.query(SessionModel).filter(SessionModel.id == session.id).first()
        assert session.status == "scored", "session left wedged in 'generating'"
        assert "no reports" in (session.notes or ""), "the reason was not recorded"
        assert "consent" in session.notes


class TestQAGate:
    def _generate(self, session_id):
        from tasks.batch_processor import run_report_generation

        run_report_generation(session_id, provider="google")

    def test_a_complete_report_passes(self, db, stub_llm, school_visit):
        from engines.qa_checker import run_qa_checks

        self._generate(school_visit["session"].id)
        result = run_qa_checks(school_visit["session"].id)

        assert result["passed"] == 1, result
        assert result["flagged"] == 0

    def test_a_broken_report_is_held_back(self, db, stub_llm, school_visit):
        """QA is the only thing between a truncated model response and a parent."""
        from engines.qa_checker import run_qa_checks

        self._generate(school_visit["session"].id)
        s = db.query(Student).filter(Student.id == school_visit["consented"].id).first()
        s.report_content = {"riasec_profile": {"summary": "too short"}}
        s.report_status = "report_generated"
        db.commit()

        run_qa_checks(school_visit["session"].id)

        db.expire_all()
        s = db.query(Student).filter(Student.id == s.id).first()
        assert s.report_status == "qa_flagged"
        assert s.qa_flags


class TestPdfAndHandover:
    @pytest.fixture()
    def ready_session(self, db, stub_llm, school_visit):
        from engines.qa_checker import run_qa_checks
        from tasks.batch_processor import run_pdf_generation, run_report_generation

        sid = school_visit["session"].id
        run_report_generation(sid, provider="google")
        run_qa_checks(sid)
        run_pdf_generation(sid)
        db.expire_all()
        return sid

    def test_the_pdf_is_a_real_document(self, db, ready_session, school_visit):
        s = db.query(Student).filter(Student.id == school_visit["consented"].id).first()
        path = Path(s.pdf_path or "")

        assert path.exists(), f"no PDF at {path}"
        assert path.read_bytes()[:5] == b"%PDF-"
        # A stub or an exception mid-render still writes a small file.
        assert path.stat().st_size > 20_000, f"only {path.stat().st_size} bytes"
        assert s.report_status == "pdf_ready"

    def test_the_survey_token_is_assigned(self, db, ready_session, school_visit):
        """Feedback, NPS and the 6-month outcome form all authenticate on it,
        and PDF generation is the only thing that writes it."""
        s = db.query(Student).filter(Student.id == school_visit["consented"].id).first()
        assert s.report_token

    def test_the_zip_holds_the_reports(self, client, admin_headers, ready_session):
        import io
        import zipfile

        r = client.get(f"/api/sessions/{ready_session}/download", headers=admin_headers)

        assert r.status_code == 200, r.text
        names = zipfile.ZipFile(io.BytesIO(r.content)).namelist()
        assert len(names) == 1, names
        assert names[0].endswith(".pdf")

    def test_a_single_report_downloads(self, client, admin_headers, ready_session, school_visit):
        """The UI reaches this through downloadFile(), which sends the token. It
        was a bare <a href> for a long time, and a browser cannot put an
        Authorization header on one — so every per-student download 401'd."""
        sid = school_visit["consented"].id

        r = client.get(f"/api/students/{sid}/pdf", headers=admin_headers)

        assert r.status_code == 200, r.text
        assert r.content[:5] == b"%PDF-"

    def test_it_needs_authentication(self, client, ready_session, school_visit):
        r = client.get(f"/api/students/{school_visit['consented'].id}/pdf")
        assert r.status_code in (401, 403)
