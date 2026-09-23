"""Add user presence timestamp safely.

Revision ID: 0008
Revises: 0007
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("users"):
        raise RuntimeError("users table must exist before applying 0008")
    columns = {item["name"] for item in inspector.get_columns("users")}
    if "last_seen_at" not in columns:
        op.add_column(
            "users",
            sa.Column(
                "last_seen_at",
                sa.DateTime(timezone=True),
                nullable=True,
                server_default=sa.func.now(),
            ),
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {item["name"] for item in inspector.get_columns("users")}
    if "last_seen_at" in columns:
        op.drop_column("users", "last_seen_at")
