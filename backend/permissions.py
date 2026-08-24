"""Role-based access control for CareerNeeti API."""

from fastapi import Depends, HTTPException
from routers.auth import get_current_user


def require_role(*allowed_roles):
    """Create a FastAPI dependency that checks user role.

    Usage: Depends(require_role("admin", "counsellor"))
    """
    def check_role(user: dict = Depends(get_current_user)) -> dict:
        role = user.get("role", "")
        if role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient permissions. Required: {', '.join(allowed_roles)}. Your role: {role}",
            )
        return user
    return check_role


# scope_query_by_school() was removed. It filtered `model_class.school_id`, but
# Student has no such column — ownership runs through Student.session_id ->
# Session.school_id — so it would have raised AttributeError had anything called
# it. It also returned the UNFILTERED query when the user had no school, i.e. it
# failed open. Use access.scoped_students / access.scoped_sessions instead.
#
# require_role() below is kept for routers not yet migrated to access.py; it
# checks role only, never ownership. access.require_role() is the replacement.
