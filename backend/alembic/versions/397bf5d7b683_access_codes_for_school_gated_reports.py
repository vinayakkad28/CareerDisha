"""access codes for school-gated reports

Adds the table behind school-issued access codes, and the column linking a
redeemed code to the assessment it unlocked.

Autogenerate also proposed dropping the server default on `schools.is_active`
and adding an FK on `students.d2c_assessment_id`. Both are removed here: the
first is a SQLite-dialect artefact (the run log says as much) and dropping a
server default on a NOT NULL boolean in Postgres risks breaking inserts that
rely on it; the second is pre-existing model/DB drift unrelated to this change.
A migration should do what its message says and nothing else.

Revision ID: 397bf5d7b683
Revises: 59b5664374a7
Create Date: 2026-09-04 15:25:41.078306

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '397bf5d7b683'
down_revision: Union[str, Sequence[str], None] = '59b5664374a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'access_codes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=32), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('max_uses', sa.Integer(), nullable=True),
        sa.Column('times_used', sa.Integer(), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ['session_id'], ['sessions.id'],
            name=op.f('fk_access_codes_session_id_sessions'),
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_access_codes')),
    )
    op.create_index(op.f('ix_access_codes_code'), 'access_codes', ['code'], unique=True)
    op.create_index(op.f('ix_access_codes_id'), 'access_codes', ['id'], unique=False)
    op.create_index(
        op.f('ix_access_codes_session_id'), 'access_codes', ['session_id'], unique=False
    )

    # batch_alter_table, not a bare create_foreign_key: SQLite cannot ALTER a
    # constraint into an existing table and raises NotImplementedError. Batch
    # mode does copy-and-move there and a plain ALTER on Postgres, so the same
    # migration runs on the local test database and in CI/production.
    with op.batch_alter_table('d2c_assessments') as batch_op:
        batch_op.add_column(sa.Column('access_code_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            op.f('fk_d2c_assessments_access_code_id_access_codes'),
            'access_codes', ['access_code_id'], ['id'],
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('d2c_assessments') as batch_op:
        batch_op.drop_constraint(
            op.f('fk_d2c_assessments_access_code_id_access_codes'),
            type_='foreignkey',
        )
        batch_op.drop_column('access_code_id')
    op.drop_index(op.f('ix_access_codes_session_id'), table_name='access_codes')
    op.drop_index(op.f('ix_access_codes_id'), table_name='access_codes')
    op.drop_index(op.f('ix_access_codes_code'), table_name='access_codes')
    op.drop_table('access_codes')
