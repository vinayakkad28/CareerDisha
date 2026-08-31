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
import re

import pytest

ROUTERS_DIR = pathlib.Path(__file__).resolve().parents[1] / "routers"

# Routers not yet migrated to access.py. Remove entries as they are converted;
# never add one back without a deliberate decision.
UNSCOPED_ROUTERS: set[str] = set()

# Public flows where a token IS the credential, so there is no session to scope
# against. d2c.py resolves an assessment by its own uuid4 token and derives the
# student from it; reports_public.py resolves the report token directly.
TOKEN_AUTHENTICATED_ROUTERS = {"d2c.py", "reports_public.py", "quiz.py"}

# Endpoints that are public by design (parents follow a link, no login).
PUBLIC_PATHS = {
    "/api/quiz/questions", "/api/quiz/submit",
    "/api/feedback/submit", "/api/outcomes/public",
    "/api/health",
}

# The dangerous pattern is resolving a row from a CLIENT-SUPPLIED id, which is
# what lets a caller walk sequential ids into another school's data.
#
# Two shapes are deliberately allowed:
#   * querying students by `session_id` once the session itself has been
#     authorised — its students are in scope by definition;
#   * deriving a row from an already-authenticated record, e.g.
#     `Student.id == assessment.student_id` after the assessment was resolved by
#     its own uuid4 token.
#
# So the check targets a lookup whose right-hand side is a bare local name (a
# path param or `req.<field>`), not an attribute of an authorised object.
#   * `Student.id == sid, Student.session_id == session_id` — the second clause
#     confines the row to a session the caller already had authorised.
#   * `School` is included deliberately. It was missing, and that blind spot let
#     schools.py stay completely unscoped while this file reported 18 passing
#     tests — a guard that passes against broken code is worse than no guard.
RAW_QUERY_PATTERN = re.compile(
    r"db\.query\((?:Student|Session|SessionModel|School)\)"
    r"\.filter\((?:Student|Session|SessionModel|School)\.id\s*==\s*"
    r"(?!\w+\.)"                       # not `obj.attr` — a derived lookup
    r"[A-Za-z_]\w*\s*"                  # a bare name: student_id, sid, school_id
    r"(?!,\s*Student\.session_id\s*==)"  # unless confined to a scoped session
    r"[,)]"
)


def _router_files():
    return sorted(p for p in ROUTERS_DIR.glob("*.py") if p.name != "__init__.py")


@pytest.mark.parametrize("path", _router_files(), ids=lambda p: p.name)
def test_converted_routers_do_not_query_entities_directly(path):
    """A converted router must go through access.py, not raw queries."""
    if path.name in UNSCOPED_ROUTERS:
        pytest.skip(f"{path.name} not yet migrated to access.py")
    if path.name in TOKEN_AUTHENTICATED_ROUTERS:
        pytest.skip(f"{path.name} is token-authenticated, not session-scoped")
    source = path.read_text()
    offenders = RAW_QUERY_PATTERN.findall(source)
    assert not offenders, (
        f"{path.name} resolves a client-supplied id without scoping: {offenders}. "
        f"Use Depends(get_scoped_student) / Depends(get_scoped_session), or "
        f"access.scoped_students(scope, db) when the id comes from a request body."
    )


def _iter_routes(router):
    """Yield every route, descending into included sub-routers.

    FastAPI <= 0.135 flattened included routers into app.routes; from 0.141 they
    are kept as nested _IncludedRouter objects. Iterating app.routes alone finds
    nothing on the newer version, which would make this test pass while checking
    zero routes — the failure mode a scoping test can least afford.
    """
    for route in getattr(router, "routes", []):
        if hasattr(route, "dependant"):
            yield route
        # 0.141 wraps an included router in _IncludedRouter.original_router;
        # older versions and mounted sub-apps expose .router or .app.
        for attr in ("original_router", "router", "app"):
            inner = getattr(route, attr, None)
            if inner is not None and inner is not route and hasattr(inner, "routes"):
                yield from _iter_routes(inner)
                break


def test_student_and_session_routes_are_scoped():
    """Every /{student_id} and /{session_id} route resolves through access.py."""
    from access import get_scoped_session, get_scoped_student, resolve_scope
    from main import app

    def dependency_calls(dependant):
        yield dependant.call
        for sub in dependant.dependencies:
            yield from dependency_calls(sub)

    unscoped = []
    entity_routes = 0
    for route in _iter_routes(app):
        dependant = getattr(route, "dependant", None)
        path = getattr(route, "path", "")
        if dependant is None or path in PUBLIC_PATHS:
            continue
        module = getattr(getattr(route, "endpoint", None), "__module__", "")
        mod_file = f"{module.rsplit('.', 1)[-1]}.py"
        if mod_file in UNSCOPED_ROUTERS or mod_file in TOKEN_AUTHENTICATED_ROUTERS:
            continue
        calls = set(dependency_calls(dependant))
        if "{student_id}" in path:
            entity_routes += 1
            if get_scoped_student not in calls:
                unscoped.append(f"{path} (student)")
        if "{session_id}" in path:
            entity_routes += 1
            if get_scoped_session not in calls:
                unscoped.append(f"{path} (session)")
        if "{school_id}" in path:
            # Schools have no resource-resolving dependency: ownership is checked
            # inside the handler via scope.assert_school or _visible_schools.
            # Assert the route at least resolves an AccessScope, which the old
            # get_current_user dependency did not.
            entity_routes += 1
            if resolve_scope not in calls:
                unscoped.append(f"{path} (school)")

    # Without this the test silently passes when route traversal breaks.
    assert entity_routes > 10, (
        f"only found {entity_routes} entity routes to check — traversal is broken, "
        "so this test is not actually verifying anything"
    )
    assert not unscoped, f"routes missing tenant scoping: {unscoped}"


def test_dead_permission_helper_is_gone():
    """scope_query_by_school could not work: Student has no school_id column."""
    import models

    assert not hasattr(models.Student, "school_id"), (
        "Student gained a school_id column — revisit access.scoped_students, "
        "which currently joins through Session to determine ownership."
    )
