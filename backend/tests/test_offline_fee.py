"""The fee is collected in person, so the system has to record it — not charge it.

Nothing is paid online. The counsellor takes cash or UPI at the school and ticks
the student off, and two things depend on that tick: the session reconciles
(collected vs expected, across ~600 parents) and counsellor commission accrues.

Commission used to be computed from ``delivery_status``, which meant it accrued
for every report handed over whether or not the parent had paid — at 60%
collection you owed 100% of the commission. These tests pin it to the money.
"""

import pytest

from models import AuditLog, CounsellorCommission, SchoolAssignment, Student


def _mark(client, headers, student_id, **body):
    body.setdefault("fee_paid", True)
    return client.put(f"/api/students/{student_id}/fee", json=body, headers=headers)


class TestRecordingCollection:
    def test_marking_paid_records_the_details(self, client, db, admin_headers, two_schools):
        s = two_schools["student_a"]
        r = _mark(client, admin_headers, s.id, fee_amount=500,
                  payment_mode="upi", collected_by="Vinayak", receipt_no="R-014")

        assert r.status_code == 200, r.text
        db.refresh(s)
        assert (s.fee_paid, s.fee_amount, s.payment_mode) == (True, 500, "upi")
        assert s.receipt_no == "R-014"
        assert s.fee_paid_at is not None

    def test_the_default_amount_is_the_session_rate(self, client, db, admin_headers, two_schools):
        s = two_schools["student_a"]
        _mark(client, admin_headers, s.id)
        db.refresh(s)
        assert s.fee_amount == 500

    def test_students_start_unpaid(self, db, two_schools):
        assert two_schools["student_a"].fee_paid in (False, None)

    def test_reversing_clears_the_record(self, client, db, admin_headers, two_schools):
        """A reversal is normally 'I ticked the wrong child', so nothing may
        survive that would still read as a collection."""
        s = two_schools["student_a"]
        _mark(client, admin_headers, s.id, payment_mode="cash", receipt_no="R-9")
        _mark(client, admin_headers, s.id, fee_paid=False)

        db.refresh(s)
        assert s.fee_paid is False
        assert (s.fee_amount, s.receipt_no, s.payment_mode) == (0, "", "")
        assert s.fee_paid_at is None

    def test_an_unknown_payment_mode_is_refused(self, client, admin_headers, two_schools):
        r = _mark(client, admin_headers, two_schools["student_a"].id, payment_mode="bitcoin")
        assert r.status_code == 422

    def test_a_negative_amount_is_refused(self, client, admin_headers, two_schools):
        r = _mark(client, admin_headers, two_schools["student_a"].id, fee_amount=-500)
        assert r.status_code == 422

    def test_collection_is_audited(self, client, db, admin_headers, two_schools):
        _mark(client, admin_headers, two_schools["student_a"].id, payment_mode="cash")
        rows = db.query(AuditLog).filter(AuditLog.action == "student_fee_updated").all()
        assert len(rows) == 1
        assert "cash" in rows[0].detail


class TestWhoMayRecordIt:
    def test_a_counsellor_may_record_their_own_schools_collection(
        self, client, two_schools
    ):
        r = _mark(client, two_schools["counsellor_headers"], two_schools["student_a"].id)
        assert r.status_code == 200, r.text

    def test_a_counsellor_cannot_touch_another_schools_student(self, client, two_schools):
        r = _mark(client, two_schools["counsellor_headers"], two_schools["student_b"].id)
        assert r.status_code == 404

    def test_a_school_admin_cannot_write_our_revenue_record(self, client, db, two_schools):
        from tests.conftest import _auth, _token

        headers = _auth(_token(
            role="school_admin", user_id=0, school_id=two_schools["school_a"].id
        ))
        r = _mark(client, headers, two_schools["student_a"].id)
        assert r.status_code in (401, 403)

    def test_it_needs_authentication(self, client, two_schools):
        r = client.put(
            f"/api/students/{two_schools['student_a'].id}/fee", json={"fee_paid": True}
        )
        assert r.status_code in (401, 403)


class TestSessionReconciliation:
    def test_the_session_reports_collected_against_expected(
        self, client, db, admin_headers, two_schools
    ):
        session = two_schools["session_a"]
        db.add(Student(session_id=session.id, name="Second", class_level=10))
        db.commit()

        _mark(client, admin_headers, two_schools["student_a"].id, fee_amount=500)

        fees = client.get(f"/api/sessions/{session.id}", headers=admin_headers).json()["fees"]
        assert fees["paid_count"] == 1
        assert fees["unpaid_count"] == 1
        assert fees["collected_inr"] == 500
        assert fees["expected_inr"] == 1000

    def test_an_untouched_session_shows_nothing_collected(
        self, client, admin_headers, two_schools
    ):
        fees = client.get(
            f"/api/sessions/{two_schools['session_a'].id}", headers=admin_headers
        ).json()["fees"]
        assert fees["collected_inr"] == 0
        assert fees["paid_count"] == 0


class TestCommissionFollowsTheMoney:
    def test_commission_counts_paid_students_not_delivered_ones(
        self, client, db, admin_headers, two_schools
    ):
        session = two_schools["session_a"]
        delivered_unpaid = Student(
            session_id=session.id, name="Handed over, never paid",
            class_level=10, delivery_status="delivered",
        )
        db.add(delivered_unpaid)
        db.commit()

        _mark(client, admin_headers, two_schools["student_a"].id)

        r = client.post(
            f"/api/counsellors/commissions/{session.id}/calculate", headers=admin_headers
        )
        assert r.status_code == 201, r.text
        row = db.query(CounsellorCommission).filter(
            CounsellorCommission.session_id == session.id
        ).first()
        assert row.students_count == 1, "the unpaid delivery was counted again"
        assert row.amount_inr == 200  # 40% of the 500 session rate

    def test_a_session_with_no_collection_records_nothing(
        self, client, db, admin_headers, two_schools
    ):
        session = two_schools["session_a"]
        two_schools["student_a"].delivery_status = "delivered"
        db.commit()

        r = client.post(
            f"/api/counsellors/commissions/{session.id}/calculate", headers=admin_headers
        )
        assert r.status_code == 400
        assert "paid" in r.json()["detail"].lower()

    def test_recording_twice_updates_rather_than_duplicates(
        self, client, db, admin_headers, two_schools
    ):
        session = two_schools["session_a"]
        _mark(client, admin_headers, two_schools["student_a"].id)
        url = f"/api/counsellors/commissions/{session.id}/calculate"
        client.post(url, headers=admin_headers)

        extra = Student(session_id=session.id, name="Paid later", class_level=10)
        db.add(extra)
        db.commit()
        _mark(client, admin_headers, extra.id)
        client.post(url, headers=admin_headers)

        rows = db.query(CounsellorCommission).filter(
            CounsellorCommission.session_id == session.id
        ).all()
        assert len(rows) == 1
        assert rows[0].students_count == 2
        assert rows[0].amount_inr == 400


class TestNothingChargesOnline:
    def test_there_is_no_route_that_takes_money(self):
        from main import app

        paths = [r.path for r in app.routes]
        for word in ("order", "checkout", "razorpay", "payment/verify"):
            assert not any(word in p.lower() for p in paths), f"{word} route is back"
