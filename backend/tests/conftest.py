"""Shared fixtures for API integration tests.

Before this file existed the suite had 99 tests and none of them made an HTTP
request — every fix in the remediation (payment bypass, IDOR, forgeable tokens,
validation, rate limiting) was verified by hand and guarded by nothing.

Two deliberate choices:

* The schema is built by running ``alembic upgrade head``, not
  ``Base.metadata.create_all()``. create_all is what hid the original 12-column
  drift, and the app refuses to boot unless the database is at the revision the
  code expects, so tests exercise the same path production does.
* Tokens are minted through ``routers.auth.create_token`` rather than
  hand-rolled, so a change to token format breaks tests loudly instead of
  letting them drift out of sync with the app.
"""

import os
import tempfile
from datetime import date
from pathlib import Path

import pytest

# Must be set before any application module is imported, because config.py reads
# the environment at import time.
TEST_JWT_SECRET = "test-only-secret-long-enough-for-hmac-sha256-signing"
os.environ.setdefault("JWT_SECRET", TEST_JWT_SECRET)
os.environ.setdefault("ADMIN_PASSWORD", "test-admin-password")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("GROQ_API_KEY", "test-key-not-used")
os.environ["AUTO_CREATE_SCHEMA"] = "0"  # set, not popped: load_dotenv would refill a popped key

BACKEND_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def database_url():
    """A migrated throwaway database for the whole test session.

    Honours DATABASE_URL when set (CI points it at Postgres); otherwise uses a
    temporary SQLite file so local runs stay fast.
    """
    external = os.environ.get("DATABASE_URL")
    if external and not external.startswith("sqlite"):
        # CI points this at the Postgres service. Honour it rather than
        # overwriting with a temp SQLite file, which is what made the whole
        # integration suite silently run on SQLite.
        url = external
        tmp = None
    else:
        tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        tmp.close()
        url = f"sqlite:///{tmp.name}"

    os.environ["DATABASE_URL"] = url

    from alembic import command
    from alembic.config import Config

    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(cfg, "head")

    yield url

    if tmp is not None:
        Path(tmp.name).unlink(missing_ok=True)


@pytest.fixture()
def db(database_url, _clean_tables):
    """A database session. Rows created here are visible to the API under test."""
    from database import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _truncate_all():
    """Delete every row, child-first, breaking the students <-> d2c_assessments cycle."""
    from database import SessionLocal
    import models

    session = SessionLocal()
    try:
        for model in (
            models.CounsellorCommission, models.SchoolAssignment, models.AuditLog,
            models.Feedback, models.StudentOutcome,
        ):
            session.query(model).delete()
        session.commit()
        # Break the FK cycle before deleting either side.
        session.query(models.Student).update({models.Student.d2c_assessment_id: None})
        session.commit()
        for model in (models.D2CAssessment, models.Student, models.Session,
                      models.Lead, models.User, models.School):
            session.query(model).delete()
        session.commit()
    finally:
        session.close()


@pytest.fixture()
def _clean_tables(database_url):
    """Truncate around each test that touches the database.

    Not autouse: the pure unit suites (scoring, QA, report generation) touch no
    database, and forcing them through alembic plus ~11 DELETEs each made them
    depend on infrastructure they do not use.

    Cleans before as well as after — teardown never runs if a previous run was
    interrupted, so without the leading sweep the first test can start dirty.
    """
    _truncate_all()
    yield
    _truncate_all()


@pytest.fixture()
def client(database_url, _clean_tables):
    """TestClient with the app's real lifespan, including the schema assertion."""
    from fastapi.testclient import TestClient

    import main

    with TestClient(main.app) as c:
        yield c


# ── identities ────────────────────────────────────────────────────────────────

def _token(**claims):
    from routers.auth import create_token

    return create_token(claims)


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def admin_headers():
    """The shared-password admin: superuser, user_id 0, no school."""
    return _auth(_token(role="admin", user_id=0))


@pytest.fixture()
def two_schools(db):
    """Two schools, each with a session and a student, plus a counsellor on A only.

    This is the shape every tenancy test needs, and it mirrors the fixture used
    to verify the original IDOR fix by hand.
    """
    from models import School, SchoolAssignment, Session as SessionModel, Student, User

    school_a = School(name="School A", code="SA", city="Noida", contact_phone="9990000001")
    school_b = School(name="School B", code="SB", city="Delhi", contact_phone="9990000002")
    db.add_all([school_a, school_b])
    db.commit()

    session_a = SessionModel(school_id=school_a.id, session_date=date.today())
    session_b = SessionModel(school_id=school_b.id, session_date=date.today())
    db.add_all([session_a, session_b])
    db.commit()

    student_a = Student(
        session_id=session_a.id, name="Aarav A", class_level=10,
        parent_phone="9990000011", family_income="below_3l",
        riasec_raw_responses={"Q1": "E"}, big_five_scores={"O": 72},
    )
    student_b = Student(
        session_id=session_b.id, name="Bhavya B", class_level=10,
        parent_phone="9990000022", family_income="above_25l",
        riasec_raw_responses={"Q1": "A"}, big_five_scores={"O": 30},
    )
    db.add_all([student_a, student_b])
    db.commit()

    counsellor = User(
        email="counsellor.a@example.com", name="Counsellor A",
        password_hash="x", role="counsellor", is_active=True,
    )
    db.add(counsellor)
    db.commit()
    db.add(SchoolAssignment(counsellor_id=counsellor.id, school_id=school_a.id, is_active=True))
    db.commit()

    return {
        "school_a": school_a, "school_b": school_b,
        "session_a": session_a, "session_b": session_b,
        "student_a": student_a, "student_b": student_b,
        "counsellor": counsellor,
        "counsellor_headers": _auth(
            _token(role="counsellor", user_id=counsellor.id, school_id=None)
        ),
    }
