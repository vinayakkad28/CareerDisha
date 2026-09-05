"""Offline fee record on students

There is no online payment. The counsellor collects the fee at the school — cash,
UPI or a cheque routed through the school — and records it against the student, so
a session reconciles (collected vs expected) and commission can accrue on money
actually received.

Backfill: rows already marked sent/delivered are set paid. Before this migration
commission was computed from ``delivery_status`` alone, so those rows have already
earned it; leaving them unpaid would silently recompute existing commissions
downwards on the next call to /commissions/record.

Revision ID: 8c1f2a4d9e30
Revises: 397bf5d7b683
"""

from alembic import op
import sqlalchemy as sa

revision = "8c1f2a4d9e30"
down_revision = "397bf5d7b683"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("students") as batch:
        batch.add_column(sa.Column("fee_amount", sa.Integer(), nullable=True, server_default="0"))
        batch.add_column(sa.Column("fee_paid", sa.Boolean(), nullable=True, server_default=sa.false()))
        batch.add_column(sa.Column("payment_mode", sa.String(length=20), nullable=True, server_default=""))
        batch.add_column(sa.Column("collected_by", sa.String(length=120), nullable=True, server_default=""))
        batch.add_column(sa.Column("receipt_no", sa.String(length=60), nullable=True, server_default=""))
        batch.add_column(sa.Column("fee_paid_at", sa.DateTime(timezone=True), nullable=True))

    op.execute(
        "UPDATE students SET fee_paid = true, fee_amount = 500 "
        "WHERE delivery_status IN ('sent', 'delivered')"
    )


def downgrade() -> None:
    with op.batch_alter_table("students") as batch:
        for col in (
            "fee_paid_at", "receipt_no", "collected_by",
            "payment_mode", "fee_paid", "fee_amount",
        ):
            batch.drop_column(col)
