"""Add friendships and direct messages.

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


def upgrade() -> None:
    op.create_table(
        "friendships",
        sa.Column("user_a_id", sa.Uuid(), nullable=False),
        sa.Column("user_b_id", sa.Uuid(), nullable=False),
        sa.Column("requested_by_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=8), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["requested_by_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_a_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_b_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_a_id", "user_b_id"),
    )
    for column in ("user_a_id", "user_b_id", "requested_by_id", "status"):
        op.create_index(f"ix_friendships_{column}", "friendships", [column])

    op.create_table(
        "direct_messages",
        sa.Column("sender_id", sa.Uuid(), nullable=False),
        sa.Column("recipient_id", sa.Uuid(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_direct_messages_sender_id", "direct_messages", ["sender_id"])
    op.create_index("ix_direct_messages_recipient_id", "direct_messages", ["recipient_id"])
    op.create_index("ix_direct_messages_created_at", "direct_messages", ["created_at"])
    op.create_index(
        "ix_direct_messages_pair_created",
        "direct_messages",
        ["sender_id", "recipient_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_table("direct_messages")
    op.drop_table("friendships")
