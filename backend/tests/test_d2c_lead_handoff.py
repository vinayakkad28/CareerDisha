"""The free quiz must be able to hand a lead off to the paid assessment.

The hand-off was severed. `/quiz/submit` issues `lead.token = uuid4().hex`, the
results page links to `/assessment?lead=<that hex>`, and the frontend posted it
as `lead_id` — which `StartRequest` declared as `Optional[int]`. Pydantic
answered `int_parsing` and `/api/d2c/start` returned 422 for every single user
who finished the free quiz and clicked through for the full report: the highest
intent cohort in the funnel. It is also the reason `Lead.converted` could never
become True, since nothing ever linked an assessment to a lead.
"""

import uuid

from models import D2CAssessment, Lead


def _lead(db, **overrides) -> Lead:
    lead = Lead(
        name="Aarav",
        phone="9990000001",
        email="aarav@example.com",
        class_level=10,
        holland_code="IRA",
        token=uuid.uuid4().hex,
        **overrides,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


class TestLeadTokenHandoff:
    def test_start_accepts_a_uuid_hex_lead_token(self, client, db):
        """The exact payload the quiz results page sends must not 422."""
        lead = _lead(db)

        r = client.post("/api/d2c/start", json={
            "student_name": "Aarav",
            "lead_token": lead.token,
            "class_level": 10,
        })

        assert r.status_code == 200, r.text
        assert r.json()["token"]

    def test_the_assessment_is_linked_to_the_lead(self, client, db):
        """Without this link Lead.converted can never flip."""
        lead = _lead(db)

        token = client.post("/api/d2c/start", json={
            "student_name": "Aarav",
            "lead_token": lead.token,
        }).json()["token"]

        assessment = db.query(D2CAssessment).filter(
            D2CAssessment.token == token
        ).first()
        assert assessment is not None
        assert assessment.lead_id == lead.id

    def test_an_unknown_token_still_starts_the_assessment(self, client):
        """Arriving cold, without taking the quiz, is a legitimate entry point.

        An unrecognised token must not be treated as an error — it just means
        there is no lead to attribute the assessment to.
        """
        r = client.post("/api/d2c/start", json={
            "student_name": "Direct Visitor",
            "lead_token": uuid.uuid4().hex,
        })
        assert r.status_code == 200, r.text

    def test_no_token_at_all_still_works(self, client):
        r = client.post("/api/d2c/start", json={"student_name": "Direct Visitor"})
        assert r.status_code == 200, r.text

    def test_integer_lead_id_is_still_accepted(self, client, db):
        """Older clients posted an integer id directly; don't break them."""
        lead = _lead(db)

        token = client.post("/api/d2c/start", json={
            "student_name": "Aarav",
            "lead_id": lead.id,
        }).json()["token"]

        assessment = db.query(D2CAssessment).filter(
            D2CAssessment.token == token
        ).first()
        assert assessment.lead_id == lead.id


class TestEmailIsNotDropped:
    def test_email_spelling_from_the_frontend_is_persisted(self, client, db):
        """The frontend posted `email` while the model declared `student_email`.

        Pydantic's extra="ignore" meant the address was silently discarded at
        /start, so any lead who abandoned before /submit had no email on file.
        """
        token = client.post("/api/d2c/start", json={
            "student_name": "Aarav",
            "email": "aarav@example.com",
        }).json()["token"]

        assessment = db.query(D2CAssessment).filter(
            D2CAssessment.token == token
        ).first()
        assert assessment.student_email == "aarav@example.com"

    def test_canonical_spelling_still_works(self, client, db):
        token = client.post("/api/d2c/start", json={
            "student_name": "Aarav",
            "student_email": "canonical@example.com",
        }).json()["token"]

        assessment = db.query(D2CAssessment).filter(
            D2CAssessment.token == token
        ).first()
        assert assessment.student_email == "canonical@example.com"
