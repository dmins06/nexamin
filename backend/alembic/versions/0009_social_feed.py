"""Add the persisted social feed without changing existing data.

Revision ID: 0009
Revises: 0008
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _ensure_table(name: str, required: set[str], create: object) -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table(name):
        columns = {item["name"] for item in inspector.get_columns(name)}
        missing = required - columns
        if missing:
            raise RuntimeError(
                f"{name} exists but is missing columns: {', '.join(sorted(missing))}"
            )
        return
    create()


def _ensure_index(table: str, name: str, columns: list[str]) -> None:
    indexes = {item["name"] for item in sa.inspect(op.get_bind()).get_indexes(table)}
    if name not in indexes:
        op.create_index(name, table, columns, unique=False)


def upgrade() -> None:
    def create_posts() -> None:
        op.create_table(
            "social_posts",
            sa.Column("author_id", sa.Uuid(), nullable=False),
            sa.Column("content", sa.Text(), nullable=False, server_default=""),
            sa.Column("image_url", sa.String(length=1000), nullable=True),
            sa.Column(
                "visibility",
                sa.Enum(
                    "PUBLIC",
                    "FRIENDS",
                    "PRIVATE",
                    name="socialpostvisibility",
                    native_enum=False,
                ),
                nullable=False,
                server_default="PUBLIC",
            ),
            sa.Column("repost_of_id", sa.Uuid(), nullable=True),
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
            sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["repost_of_id"], ["social_posts.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )

    _ensure_table(
        "social_posts",
        {
            "author_id",
            "content",
            "image_url",
            "visibility",
            "repost_of_id",
            "id",
            "created_at",
            "updated_at",
        },
        create_posts,
    )
    _ensure_index("social_posts", "ix_social_posts_author_id", ["author_id"])
    _ensure_index("social_posts", "ix_social_posts_visibility", ["visibility"])
    _ensure_index("social_posts", "ix_social_posts_repost_of_id", ["repost_of_id"])

    def create_likes() -> None:
        op.create_table(
            "social_post_likes",
            sa.Column("post_id", sa.Uuid(), nullable=False),
            sa.Column("user_id", sa.Uuid(), nullable=False),
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["post_id"], ["social_posts.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("post_id", "user_id"),
        )

    _ensure_table(
        "social_post_likes",
        {"post_id", "user_id", "id", "created_at"},
        create_likes,
    )
    _ensure_index("social_post_likes", "ix_social_post_likes_post_id", ["post_id"])
    _ensure_index("social_post_likes", "ix_social_post_likes_user_id", ["user_id"])

    def create_comments() -> None:
        op.create_table(
            "social_comments",
            sa.Column("post_id", sa.Uuid(), nullable=False),
            sa.Column("author_id", sa.Uuid(), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["post_id"], ["social_posts.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    _ensure_table(
        "social_comments",
        {"post_id", "author_id", "content", "id", "created_at"},
        create_comments,
    )
    _ensure_index("social_comments", "ix_social_comments_post_id", ["post_id"])
    _ensure_index("social_comments", "ix_social_comments_author_id", ["author_id"])
    _ensure_index("social_comments", "ix_social_comments_created_at", ["created_at"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for table in ("social_comments", "social_post_likes", "social_posts"):
        if inspector.has_table(table):
            op.drop_table(table)
            inspector = sa.inspect(op.get_bind())
