"""Add course completion and grade fields without changing existing data.

Revision ID: 0007
Revises: 0006
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("courses"):
        raise RuntimeError("courses table must exist before applying 0007")
    columns = {item["name"] for item in inspector.get_columns("courses")}
    additions = {
        "credits": sa.Column("credits", sa.Integer(), nullable=False, server_default="3"),
        "final_score": sa.Column("final_score", sa.Float(), nullable=True),
        "is_completed": sa.Column(
            "is_completed", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        "completed_at": sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    }
    for name, column in additions.items():
        if name not in columns:
            op.add_column("courses", column)


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {item["name"] for item in inspector.get_columns("courses")}
    for name in ("completed_at", "is_completed", "final_score", "credits"):
        if name in columns:
            op.drop_column("courses", name)
