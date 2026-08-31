"""Response models for school data.

Explicit field lists rather than dumping every column, matching the approach in
schemas/students.py. The previous endpoints returned
`{c.name: getattr(school, c.name) for c in school.__table__.columns}` and the
same for every nested Session, so adding a column silently published it.
"""

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _default_if_none(default: Any):
    """Coerce a NULL column to the field's default rather than failing validation.

    These columns are nullable with Python-side defaults only — no
    server_default — so any row written by raw SQL, a data migration or a bulk
    import can hold NULL. Declaring them non-Optional turned that into a
    ValidationError, i.e. a 500 for the whole list from one bad row, where the
    previous column-dump serialised null and the page rendered.
    """

    def _coerce(v: Any) -> Any:
        return default() if v is None and callable(default) else (default if v is None else v)

    return _coerce


class SchoolSummary(BaseModel):
    """Row shape for the schools list."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str
    city: str
    board: str = "CBSE"
    contact_person: str = ""
    contact_phone: str = ""
    total_sessions: int = 0
    total_students: int = 0

    _fix_board = field_validator("board", mode="before")(_default_if_none("CBSE"))
    _fix_person = field_validator("contact_person", mode="before")(_default_if_none(""))
    _fix_phone = field_validator("contact_phone", mode="before")(_default_if_none(""))


class SchoolSessionSummary(BaseModel):
    """A session as shown on the school detail page.

    Deliberately excludes the operational internals the page never reads —
    counsellor_certification, llm_provider, total_cost, generation_started_at,
    created_by and notes — which were previously returned for every session of
    every school to any authenticated caller.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    session_date: Optional[date] = None
    classes_assessed: list = Field(default_factory=list)
    status: str = "draft"
    total_students: int = 0

    _fix_classes = field_validator("classes_assessed", mode="before")(_default_if_none(list))
    _fix_status = field_validator("status", mode="before")(_default_if_none("draft"))
    _fix_total = field_validator("total_students", mode="before")(_default_if_none(0))


class SchoolDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str
    city: str
    board: str = "CBSE"
    contact_person: str = ""
    contact_phone: str = ""
    is_active: bool = True
    created_at: Optional[datetime] = None
    # Excluded from validation input on purpose — see routers/schools.py. A field
    # named `sessions` would otherwise lazy-load the School.sessions relationship
    # during model_validate.
    sessions: list[SchoolSessionSummary] = Field(default_factory=list)

    _fix_board_d = field_validator("board", mode="before")(_default_if_none("CBSE"))
    _fix_person_d = field_validator("contact_person", mode="before")(_default_if_none(""))
    _fix_phone_d = field_validator("contact_phone", mode="before")(_default_if_none(""))
    _fix_active = field_validator("is_active", mode="before")(_default_if_none(True))
