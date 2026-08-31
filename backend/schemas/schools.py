"""Response models for school data.

Explicit field lists rather than dumping every column, matching the approach in
schemas/students.py. The previous endpoints returned
`{c.name: getattr(school, c.name) for c in school.__table__.columns}` and the
same for every nested Session, so adding a column silently published it.
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


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
    sessions: list[SchoolSessionSummary] = Field(default_factory=list)
