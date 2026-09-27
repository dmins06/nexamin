"""Track reviewed source rights and idempotent question imports.

Revision ID: 0012
Revises: 0011
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "question_sources",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(250), nullable=False),
        sa.Column("url", sa.String(1000), nullable=False, unique=True),
        sa.Column("source_type", sa.String(40), nullable=False),
        sa.Column("license", sa.String(120)),
        sa.Column("institution", sa.String(250)),
        sa.Column("rights_url", sa.String(1000)),
        sa.Column("subject_hint", sa.String(200)),
        sa.Column("import_status", sa.String(20), nullable=False),
        sa.Column("retrieved_at", sa.DateTime(timezone=True)),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "practice_import_runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("source_id", sa.Uuid(), sa.ForeignKey("question_sources.id"), nullable=False),
        sa.Column("content_sha256", sa.String(64), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("parsed_count", sa.Integer(), nullable=False),
        sa.Column("imported_count", sa.Integer(), nullable=False),
        sa.Column("duplicate_count", sa.Integer(), nullable=False),
        sa.Column("rejected_count", sa.Integer(), nullable=False),
        sa.Column("pending_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("source_id", "content_sha256"),
    )
    op.create_table(
        "practice_subject_catalog_courses",
        sa.Column("subject_id", sa.Uuid(), sa.ForeignKey("practice_subjects.id"), primary_key=True),
        sa.Column("catalog_course_id", sa.Uuid(), sa.ForeignKey("catalog_courses.id"), primary_key=True),
    )
    with op.batch_alter_table("practice_questions") as batch:
        batch.add_column(sa.Column("source_id", sa.Uuid(), nullable=True))
        batch.add_column(sa.Column("source_external_id", sa.String(200), nullable=True))
        batch.create_foreign_key(
            "fk_practice_questions_source_id_question_sources", "question_sources", ["source_id"], ["id"]
        )
        batch.create_unique_constraint("uq_pq_source_external", ["source_id", "source_external_id"])


def downgrade() -> None:
    with op.batch_alter_table("practice_questions") as batch:
        batch.drop_constraint("uq_pq_source_external", type_="unique")
        batch.drop_constraint("fk_practice_questions_source_id_question_sources", type_="foreignkey")
        batch.drop_column("source_external_id")
        batch.drop_column("source_id")
    op.drop_table("practice_import_runs")
    op.drop_table("practice_subject_catalog_courses")
    op.drop_table("question_sources")
