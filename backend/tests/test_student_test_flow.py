"""The pilot flow: a student takes the test, and that is all they do online.

There is no online report, no PDF download for the student, and no payment. The
counsellor generates reports in batch from the admin and hands over the PDFs.

What still has to be exactly right is where a submitted test *lands*. A student
who redeems their school's access code must appear on that school's session
roster with consent attached, because tasks/batch_processor refuses to generate
a report for a student without consent — so a mis-routed student silently gets
nothing, and the counsellor has no way to see why.
"""

from datetime import date

import pytest

from models import AccessCode, D2CAssessment, School, Session as SessionModel, Student


@pytest.fixture()
def school_session(db):
    school = School(name="Pilot School", code="PS1", city="Meerut", contact_phone="9990000001")
    db.add(school)
    db.commit()
    session = SessionModel(school_id=school.id, session_date=date.today(),
                           counsellor_name="V. Kad")
    db.add(session)
    db.commit()
    return session


def _code(db, session, code="ABCD2345", **kw) -> AccessCode:
    c = AccessCode(code=code, session_id=session.id, **kw)
    db.add(c)
    db.commit()
    return c


def _answers() -> dict:
    return {f"Q{i}": ("A" if i % 3 == 0 else "B" if i % 3 == 1 else "D") for i in range(1, 75)}


def _submit(client, token, **over):
    payload = {"student_name": "Riya Sharma", "class_level": 10, "answers": _answers()}
    payload.update(over)
    return client.post(f"/api/d2c/submit/{token}", json=payload)


class TestACodedStudentLandsInTheirSchoolSession:
    def test_student_is_attached_to_the_codes_session(self, client, db, school_session):
        _code(db, school_session)
        token = client.post("/api/d2c/start", json={"student_name": "Riya"}).json()["token"]
        client.post(f"/api/d2c/redeem/{token}", json={"code": "ABCD2345"})

        assert _submit(client, token).status_code == 200

        student = db.query(Student).filter(Student.name == "Riya Sharma").first()
        assert student is not None
        assert student.session_id == school_session.id, (
            "a coded student landed outside their school session — the counsellor "
            "will never see them on the roster"
        )

    def test_that_student_carries_consent_from_the_paper_circular(
        self, client, db, school_session
    ):
        """batch_processor refuses to generate without it, silently."""
        _code(db, school_session)
        token = client.post("/api/d2c/start", json={"student_name": "Riya"}).json()["token"]
        client.post(f"/api/d2c/redeem/{token}", json={"code": "ABCD2345"})
        _submit(client, token)

        student = db.query(Student).filter(Student.name == "Riya Sharma").first()
        assert student.consent_obtained is True
        assert student.consent_method == "paper_form"

    def test_an_uncoded_student_is_recorded_without_consent(self, client, db):
        """Honest gap, not a fabricated record — and no report is generated."""
        token = client.post("/api/d2c/start", json={"student_name": "Nobody"}).json()["token"]
        _submit(client, token, student_name="Walk In")

        student = db.query(Student).filter(Student.name == "Walk In").first()
        assert student is not None
        assert student.consent_obtained is False

        from tasks.batch_processor import _generate_one

        cost, err = _generate_one(student.id, {}, "google")
        assert err == "no_consent"
        assert cost == 0.0


class TestTheStudentGetsNothingOnline:
    @pytest.mark.parametrize("path", [
        "/api/d2c/report/{t}", "/api/d2c/pdf/{t}", "/api/d2c/preview/{t}", "/api/reports/{t}",
    ])
    def test_no_report_surface_exists(self, client, path):
        token = client.post("/api/d2c/start", json={"student_name": "Riya"}).json()["token"]
        r = client.get(path.format(t=token))
        assert r.status_code == 404, (
            f"{path} still answers {r.status_code}; the student is not meant to "
            "receive a report online"
        )

    def test_status_says_only_whether_the_answers_landed(self, client, db, school_session):
        _code(db, school_session)
        token = client.post("/api/d2c/start", json={"student_name": "Riya"}).json()["token"]
        client.post(f"/api/d2c/redeem/{token}", json={"code": "ABCD2345"})

        before = client.get(f"/api/d2c/status/{token}").json()
        assert before["submitted"] is False

        _submit(client, token)
        after = client.get(f"/api/d2c/status/{token}").json()
        assert after["submitted"] is True
        # Nothing that invites the student to expect a download.
        assert "pdf_available" not in after
        assert "report_ready" not in after


class TestGenerationIsNotTriggeredByTheStudent:
    def test_submitting_does_not_start_a_report(self, client, db, school_session):
        """Reports are produced in batch by the counsellor, not on submit.

        The old flow spawned a daemon thread per submission, which on a shared
        instance meant a classroom of students each kicking off an LLM call at
        once with nothing supervising them.
        """
        _code(db, school_session)
        token = client.post("/api/d2c/start", json={"student_name": "Riya"}).json()["token"]
        client.post(f"/api/d2c/redeem/{token}", json={"code": "ABCD2345"})
        body = _submit(client, token).json()

        assert body["status"] == "assessment_complete"
        student = db.query(Student).filter(Student.name == "Riya Sharma").first()
        assert student.report_status == "scored"
        assert not student.report_content

    def test_the_online_generation_path_is_gone(self):
        import routers.d2c as d2c

        for gone in ("_start_report_generation", "_generate_d2c_report",
                     "report_is_unlocked", "assert_report_is_deliverable"):
            assert not hasattr(d2c, gone), f"{gone} came back"


class TestClassLevelFallback:
    """SubmitRequest documents ``class_level: 0`` as "use what /start recorded".

    The validation read the request field directly, so a client that left it out
    hit a hard 400 after the student had answered all 110 items. The web app
    happens to always send it, which is exactly why this went unnoticed.
    """

    def _finish(self, client, token, body):
        qs = client.get("/api/d2c/questions").json()["riasec_questions"]
        body["answers"] = {q["key"]: 3 for q in qs}
        return client.post(f"/api/d2c/submit/{token}", json=body)

    def test_submit_without_a_class_uses_the_one_given_at_start(self, client):
        token = client.post(
            "/api/d2c/start", json={"student_name": "Riya", "class_level": 11}
        ).json()["token"]

        r = self._finish(client, token, {})

        assert r.status_code == 200, r.text
        assert r.json().get("class_level", 11) == 11

    def test_an_out_of_range_class_is_still_refused(self, client):
        token = client.post(
            "/api/d2c/start", json={"student_name": "Riya", "class_level": 11}
        ).json()["token"]

        r = self._finish(client, token, {"class_level": 7})

        assert r.status_code == 400
        assert "Class must be" in r.json()["detail"]
