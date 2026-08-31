"""Cross-tenant access must return 404, and responses must not leak PII.

Guards the IDOR fixed in the remediation: GET /api/students/{id} returned every
column — RIASEC raw responses, Big Five scores, family income, parental
education, parent phone, consent records — for any sequential id, to any
authenticated user of any role, including a counsellor from another school.
"""

import pytest

# Fields that must never reach a client. Asserting on this list is what catches
# a future developer adding a sensitive column to a response model.
FORBIDDEN_STUDENT_FIELDS = [
    "riasec_raw_responses", "aptitude_raw_responses", "aptitude_scores",
    "tipi_raw_responses", "big_five_scores", "career_readiness_responses",
    "family_income", "parental_education", "self_efficacy", "academic_marks",
    "consent_parent_name", "consent_method", "llm_cost", "pdf_path",
    "report_token", "coaching_affordability", "mobility_willingness",
]


class TestStudentTenancy:
    def test_own_school_student_is_visible(self, client, two_schools):
        r = client.get(f"/api/students/{two_schools['student_a'].id}",
                       headers=two_schools["counsellor_headers"])
        assert r.status_code == 200
        assert r.json()["name"] == "Aarav A"

    def test_other_school_student_is_404_not_403(self, client, two_schools):
        """404, so ids stay non-enumerable and the client does not sign the user out."""
        r = client.get(f"/api/students/{two_schools['student_b'].id}",
                       headers=two_schools["counsellor_headers"])
        assert r.status_code == 404

    @pytest.mark.parametrize("suffix", ["", "/pdf", "/share-card"])
    def test_all_student_routes_are_scoped(self, client, two_schools, suffix):
        r = client.get(f"/api/students/{two_schools['student_b'].id}{suffix}",
                       headers=two_schools["counsellor_headers"])
        assert r.status_code == 404

    def test_delivery_update_is_scoped(self, client, two_schools):
        r = client.put(f"/api/students/{two_schools['student_b'].id}/delivery",
                       json={"delivery_status": "delivered"},
                       headers=two_schools["counsellor_headers"])
        assert r.status_code == 404

    def test_response_contains_no_pii(self, client, two_schools):
        r = client.get(f"/api/students/{two_schools['student_a'].id}",
                       headers=two_schools["counsellor_headers"])
        body = r.json()
        leaked = [f for f in FORBIDDEN_STUDENT_FIELDS if f in body]
        assert not leaked, f"student response leaks {leaked}"

    def test_unauthenticated_is_401(self, client, two_schools):
        r = client.get(f"/api/students/{two_schools['student_a'].id}")
        assert r.status_code == 401


class TestSessionTenancy:
    def test_session_list_is_scoped(self, client, two_schools):
        r = client.get("/api/sessions", headers=two_schools["counsellor_headers"])
        assert r.status_code == 200
        names = {row["school_name"] for row in r.json()}
        assert names == {"School A"}

    def test_other_school_session_is_404(self, client, two_schools):
        r = client.get(f"/api/sessions/{two_schools['session_b'].id}",
                       headers=two_schools["counsellor_headers"])
        assert r.status_code == 404

    def test_cannot_create_session_for_another_school(self, client, two_schools):
        r = client.post("/api/sessions",
                        json={"school_id": two_schools["school_b"].id,
                              "session_date": "2026-08-01"},
                        headers=two_schools["counsellor_headers"])
        assert r.status_code == 404

    def test_session_students_carry_no_pii(self, client, two_schools):
        r = client.get(f"/api/sessions/{two_schools['session_a'].id}",
                       headers=two_schools["counsellor_headers"])
        assert r.status_code == 200
        students = r.json()["students"]
        assert students, "expected the seeded student"
        leaked = [f for f in FORBIDDEN_STUDENT_FIELDS if f in students[0]]
        assert not leaked, f"session student rows leak {leaked}"


class TestSchoolTenancy:
    """The Phase 0 hole: schools.py was entirely unscoped."""

    def test_list_shows_only_own_schools(self, client, two_schools):
        r = client.get("/api/schools", headers=two_schools["counsellor_headers"])
        assert r.status_code == 200
        assert [s["name"] for s in r.json()] == ["School A"]

    def test_admin_sees_all_schools(self, client, two_schools, admin_headers):
        r = client.get("/api/schools", headers=admin_headers)
        assert {s["name"] for s in r.json()} == {"School A", "School B"}

    def test_other_school_detail_is_404(self, client, two_schools):
        r = client.get(f"/api/schools/{two_schools['school_b'].id}",
                       headers=two_schools["counsellor_headers"])
        assert r.status_code == 404

    def test_counsellor_cannot_update_any_school(self, client, two_schools):
        for school in (two_schools["school_a"], two_schools["school_b"]):
            r = client.put(f"/api/schools/{school.id}",
                           json={"contact_phone": "6666666666"},
                           headers=two_schools["counsellor_headers"])
            assert r.status_code == 403, f"counsellor edited school {school.id}"

    def test_counsellor_cannot_create_a_school(self, client, two_schools):
        r = client.post("/api/schools",
                        json={"name": "Rogue", "code": "RG", "city": "X"},
                        headers=two_schools["counsellor_headers"])
        assert r.status_code == 403

    def test_counsellor_cannot_delete_a_school(self, client, two_schools):
        r = client.delete(f"/api/schools/{two_schools['school_b'].id}",
                          headers=two_schools["counsellor_headers"])
        assert r.status_code == 403

    def test_school_detail_omits_session_internals(self, client, two_schools, admin_headers):
        r = client.get(f"/api/schools/{two_schools['school_a'].id}", headers=admin_headers)
        sessions = r.json()["sessions"]
        assert sessions
        leaked = [f for f in ("llm_provider", "total_cost", "notes", "created_by",
                              "generation_started_at", "counsellor_certification")
                  if f in sessions[0]]
        assert not leaked, f"school detail leaks session internals {leaked}"

    def test_admin_update_writes_an_audit_entry(self, client, two_schools, admin_headers, db):
        from models import AuditLog

        r = client.put(f"/api/schools/{two_schools['school_a'].id}",
                       json={"contact_person": "New Person"}, headers=admin_headers)
        assert r.status_code == 200
        entries = db.query(AuditLog).filter(AuditLog.action == "school.update").all()
        assert entries, "school update produced no audit entry"

    def test_deactivated_school_disappears(self, client, two_schools, admin_headers):
        sid = two_schools["school_b"].id
        assert client.delete(f"/api/schools/{sid}", headers=admin_headers).status_code == 200
        assert client.get(f"/api/schools/{sid}", headers=admin_headers).status_code == 404
        assert [s["name"] for s in client.get("/api/schools", headers=admin_headers).json()] == ["School A"]

    def test_deactivating_a_school_also_hides_its_students_and_sessions(
        self, client, two_schools, admin_headers
    ):
        """Soft delete must not leave the PII behind.

        Hiding only the School row left every session — and through them every
        student, report and delivery endpoint — fully readable.
        """
        assert client.delete(f"/api/schools/{two_schools['school_b'].id}",
                             headers=admin_headers).status_code == 200

        sid = two_schools["session_b"].id
        stid = two_schools["student_b"].id
        assert client.get(f"/api/sessions/{sid}", headers=admin_headers).status_code == 404
        assert client.get(f"/api/students/{stid}", headers=admin_headers).status_code == 404
        listed = client.get("/api/sessions", headers=admin_headers).json()
        assert all(row["school_name"] != "School B" for row in listed)

    def test_deactivated_code_can_be_reactivated(self, client, two_schools, admin_headers):
        """A soft-deleted code must not be burned forever.

        create_school checked uniqueness without regard to is_active, so the code
        stayed taken while detail and update both 404'd on it — unreachable and
        unusable, with nothing that could set is_active back to True.
        """
        assert client.delete(f"/api/schools/{two_schools['school_b'].id}",
                             headers=admin_headers).status_code == 200
        r = client.post("/api/schools",
                        json={"name": "School B Reborn", "code": "SB", "city": "Delhi"},
                        headers=admin_headers)
        assert r.status_code == 201, r.text
        assert r.json()["name"] == "School B Reborn"
        assert client.get(f"/api/schools/{r.json()['id']}", headers=admin_headers).status_code == 200
