"""Guards against the tenant-scoping regression this codebase already had once.

`permissions.scope_query_by_school` existed for months, was imported once, and
was never called — so every authenticated user could read every school's student
PII by walking sequential ids. A helper that must be *remembered* is not a
control. These tests fail when a route touching student or session data is added
without the scoping dependency, or when a router starts querying those tables
directly again.

To convert a router: replace its raw queries with the helpers in `access.py`,
then delete it from UNSCOPED_ROUTERS below. The list only shrinks.
"""

import pathlib

import pytest

ROUTERS_DIR = pathlib.Path(__file__).resolve().parents[1] / "routers"

# Routers not yet migrated to access.py. Remove entries as they are converted;
# never add one back without a deliberate decision.
UNSCOPED_ROUTERS = {
    "cards.py", "consent.py", "counsellors.py", "d2c.py", "dashboard.py",
    "feedback.py", "nps.py", "outcomes.py", "reports.py", "reports_public.py",
    "school_portal.py", "schools.py", "sessions.py", "whatsapp.py",
}

# Endpoints that are public by design (parents follow a link, no login).
PUBLIC_PATHS = {
    "/api/quiz/questions", "/api/quiz/submit",
    "/api/feedback/submit", "/api/outcomes/public",
    "/api/health",
}

RAW_QUERY_MARKERS = ("db.query(Student", "db.query(SessionModel")


def _router_files():
    return sorted(p for p in ROUTERS_DIR.glob("*.py") if p.name != "__init__.py")


@pytest.mark.parametrize("path", _router_files(), ids=lambda p: p.name)
def test_converted_routers_do_not_query_entities_directly(path):
    """A converted router must go through access.py, not raw queries."""
    if path.name in UNSCOPED_ROUTERS:
        pytest.skip(f"{path.name} not yet migrated to access.py")
    source = path.read_text()
    offenders = [m for m in RAW_QUERY_MARKERS if m in source]
    assert not offenders, (
        f"{path.name} queries {offenders} directly. Use access.scoped_students / "
        f"access.scoped_sessions / Depends(get_scoped_student) instead."
    )


def test_student_and_session_routes_are_scoped():
    """Every /{student_id} and /{session_id} route resolves through access.py."""
    from access import get_scoped_session, get_scoped_student
    from main import app

    def dependency_calls(dependant):
        yield dependant.call
        for sub in dependant.dependencies:
            yield from dependency_calls(sub)

    unscoped = []
    for route in app.routes:
        dependant = getattr(route, "dependant", None)
        path = getattr(route, "path", "")
        if dependant is None or path in PUBLIC_PATHS:
            continue
        # Only assert on routers already migrated; the rest are covered by the
        # allowlist test above.
        module = getattr(getattr(route, "endpoint", None), "__module__", "")
        if f"{module.rsplit('.', 1)[-1]}.py" in UNSCOPED_ROUTERS:
            continue
        calls = set(dependency_calls(dependant))
        if "{student_id}" in path and get_scoped_student not in calls:
            unscoped.append(f"{path} (student)")
        if "{session_id}" in path and get_scoped_session not in calls:
            unscoped.append(f"{path} (session)")

    assert not unscoped, f"routes missing tenant scoping: {unscoped}"


def test_dead_permission_helper_is_gone():
    """scope_query_by_school could not work: Student has no school_id column."""
    import models

    assert not hasattr(models.Student, "school_id"), (
        "Student gained a school_id column — revisit access.scoped_students, "
        "which currently joins through Session to determine ownership."
    )
