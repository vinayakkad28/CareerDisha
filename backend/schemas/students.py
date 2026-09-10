"""Response models for student data.

These exist because the endpoints previously returned every column via
``{c.name: getattr(student, c.name) for c in student.__table__.columns}``,
which shipped RIASEC raw responses, aptitude and Big Five scores, family income,
parental education, parent phone numbers and consent records to any
authenticated caller. Each model below lists only the fields the frontend
actually reads, so adding a sensitive column to the model does not silently
publish it.
"""

from pydantic import BaseModel, ConfigDict, Field


class StudentSummary(BaseModel):
    """Row shape for student lists (e.g. the session detail page)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    class_level: int
    section: str = ""
    parent_phone: str = ""
    holland_code: str = ""
    riasec_scores: dict = Field(default_factory=dict)
    report_status: str = "pending"
    delivery_status: str = "pending"
    consent_obtained: bool = False
    fee_paid: bool = False
    fee_amount: int = 0


class StudentDetail(BaseModel):
    """Single-student shape for the student detail page."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    name: str
    class_level: int
    section: str = ""
    holland_code: str = ""
    parent_name: str = ""
    parent_phone: str = ""
    report_status: str = "pending"
    delivery_status: str = "pending"
    fee_paid: bool = False
    fee_amount: int = 0
    payment_mode: str = ""
    receipt_no: str = ""
    riasec_scores: dict = Field(default_factory=dict)
    report_content: dict = Field(default_factory=dict)
    # Replaces pdf_path, which the client only tested for truthiness and which
    # leaked an absolute server filesystem path.
    pdf_available: bool = False
