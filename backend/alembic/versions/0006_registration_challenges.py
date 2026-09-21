"""Add registration OTP challenges safely.

Revision ID: 0006
Revises: 0005
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _ensure_index(table_name: str, index_name: str, columns: list[str]) -> None:
    inspector = sa.inspect(op.get_bind())
    indexes = {item["name"]: item for item in inspector.get_indexes(table_name)}
    existing = indexes.get(index_name)
    if existing is not None:
        if existing.get("column_names") != columns or bool(existing.get("unique")):
            raise RuntimeError(f"{index_name} exists with an unexpected definition")
        return
    op.create_index(index_name, table_name, columns, unique=False)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    required = {
        "id",
        "email",
        "code_hash",
        "registration_data",
        "expires_at",
        "attempts",
        "consumed_at",
        "created_at",
    }
    if inspector.has_table("registration_challenges"):
        columns = {item["name"] for item in inspector.get_columns("registration_challenges")}
        missing = required - columns
        if missing:
            raise RuntimeError(
                "registration_challenges exists but is missing required columns: "
                + ", ".join(sorted(missing))
            )
    else:
        op.create_table(
            "registration_challenges",
            sa.Column("email", sa.String(length=320), nullable=False),
            sa.Column("code_hash", sa.String(length=64), nullable=False),
            sa.Column("registration_data", sa.JSON(), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
    _ensure_index("registration_challenges", "ix_registration_challenges_email", ["email"])
    _ensure_index(
        "registration_challenges",
        "ix_registration_challenges_expires_at",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_table("registration_challenges")
