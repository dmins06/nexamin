"""Add friendships and direct messages, reconciling pre-Alembic tables safely.

Revision ID: 0005
Revises: 0004
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _existing_table(name: str, required_columns: set[str]) -> bool:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(name):
        return False

    columns = {item["name"] for item in inspector.get_columns(name)}
    missing = required_columns - columns
    if missing:
        missing_list = ", ".join(sorted(missing))
        raise RuntimeError(f"{name} exists but is missing required columns: {missing_list}")
    return True


def _ensure_index(
    table_name: str,
    index_name: str,
    columns: list[str],
    *,
    unique: bool = False,
) -> None:
    inspector = sa.inspect(op.get_bind())
    indexes = {item["name"]: item for item in inspector.get_indexes(table_name)}
    existing = indexes.get(index_name)
    if existing is not None:
        if existing.get("column_names") != columns or bool(existing.get("unique")) != unique:
            raise RuntimeError(
                f"{index_name} exists with a definition that does not match the migration"
            )
        return
    op.create_index(index_name, table_name, columns, unique=unique)


def _ensure_friendships() -> None:
    exists = _existing_table(
        "friendships",
        {
            "user_a_id",
            "user_b_id",
            "requested_by_id",
            "status",
            "id",
            "created_at",
            "updated_at",
        },
    )
    if not exists:
        op.create_table(
            "friendships",
            sa.Column("user_a_id", sa.Uuid(), nullable=False),
            sa.Column("user_b_id", sa.Uuid(), nullable=False),
            sa.Column("requested_by_id", sa.Uuid(), nullable=False),
            sa.Column("status", sa.String(length=8), nullable=False),
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(
                ["requested_by_id"],
                ["users.id"],
                ondelete="CASCADE",
            ),
            sa.ForeignKeyConstraint(["user_a_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_b_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_a_id", "user_b_id"),
        )
    else:
        inspector = sa.inspect(op.get_bind())
        unique_pairs = {
            tuple(item.get("column_names") or [])
            for item in inspector.get_unique_constraints("friendships")
        }
        unique_indexes = {
            tuple(item.get("column_names") or [])
            for item in inspector.get_indexes("friendships")
            if item.get("unique")
        }
        if ("user_a_id", "user_b_id") not in unique_pairs | unique_indexes:
            op.create_unique_constraint(
                "uq_friendships_user_a_id",
                "friendships",
                ["user_a_id", "user_b_id"],
            )

    for column in ("user_a_id", "user_b_id", "requested_by_id", "status"):
        _ensure_index("friendships", f"ix_friendships_{column}", [column])


def _ensure_direct_messages() -> None:
    exists = _existing_table(
        "direct_messages",
        {
            "sender_id",
            "recipient_id",
            "content",
            "created_at",
            "read_at",
            "id",
        },
    )
    if not exists:
        op.create_table(
            "direct_messages",
            sa.Column("sender_id", sa.Uuid(), nullable=False),
            sa.Column("recipient_id", sa.Uuid(), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.ForeignKeyConstraint(["recipient_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    _ensure_index("direct_messages", "ix_direct_messages_sender_id", ["sender_id"])
    _ensure_index("direct_messages", "ix_direct_messages_recipient_id", ["recipient_id"])
    _ensure_index("direct_messages", "ix_direct_messages_created_at", ["created_at"])
    _ensure_index(
        "direct_messages",
        "ix_direct_messages_pair_created",
        ["sender_id", "recipient_id", "created_at"],
    )


def upgrade() -> None:
    _ensure_friendships()
    _ensure_direct_messages()


def downgrade() -> None:
    op.drop_table("direct_messages")
    op.drop_table("friendships")
