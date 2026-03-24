"""Role-based access control for CareerDisha API."""

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


def scope_query_by_school(user: dict, query, model_class):
    """Filter query by school_id for school_admin users.

    Admin and counsellor see everything.
    school_admin sees only their school's data.
    """
    if user.get("role") == "school_admin" and user.get("school_id"):
        return query.filter(model_class.school_id == user["school_id"])
    return query
