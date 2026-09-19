"""Allow full training-program names in user profiles.

Revision ID: 0004
Revises: 0003
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "major",
        existing_type=sa.String(length=150),
        type_=sa.String(length=300),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "users",
        "major",
        existing_type=sa.String(length=300),
        type_=sa.String(length=150),
        existing_nullable=True,
    )
