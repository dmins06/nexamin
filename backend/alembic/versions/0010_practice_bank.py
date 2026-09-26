"""Add reusable practice bank, exams and attempt snapshots.

Revision ID: 0010
Revises: 0009
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _id() -> sa.Column[object]:
    return sa.Column("id", sa.Uuid(), primary_key=True)


def _created() -> sa.Column[object]:
    return sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())


def _updated() -> sa.Column[object]:
    return sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())


def upgrade() -> None:
    op.create_table(
        "practice_subjects",
        _id(),
        sa.Column("name", sa.String(200), nullable=False, unique=True),
        sa.Column("code", sa.String(40), unique=True),
        sa.Column("description", sa.Text()),
        _created(),
        _updated(),
    )
    op.create_table(
        "practice_chapters",
        _id(),
        sa.Column("subject_id", sa.Uuid(), sa.ForeignKey("practice_subjects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(250), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.UniqueConstraint("subject_id", "title"),
    )
    op.create_index("ix_practice_chapters_subject_id", "practice_chapters", ["subject_id"])
    op.create_table(
        "practice_topics",
        _id(),
        sa.Column("chapter_id", sa.Uuid(), sa.ForeignKey("practice_chapters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(250), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.UniqueConstraint("chapter_id", "title"),
    )
    op.create_index("ix_practice_topics_chapter_id", "practice_topics", ["chapter_id"])
    op.create_table(
        "practice_questions",
        _id(),
        sa.Column("subject_id", sa.Uuid(), sa.ForeignKey("practice_subjects.id"), nullable=False),
        sa.Column("chapter_id", sa.Uuid(), sa.ForeignKey("practice_chapters.id")),
        sa.Column("topic_id", sa.Uuid(), sa.ForeignKey("practice_topics.id")),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("question_type", sa.Enum(
            "SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER",
            "MATCHING", "FILL_BLANK", "CODING", name="practicequestiontype", native_enum=False,
        ), nullable=False),
        sa.Column("difficulty", sa.String(12), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("source_name", sa.String(250), nullable=False),
        sa.Column("source_url", sa.String(1000)),
        sa.Column("source_license", sa.String(120), nullable=False),
        sa.Column("source_type", sa.String(40), nullable=False),
        sa.Column("retrieved_at", sa.DateTime(timezone=True)),
        sa.Column("generation_type", sa.Enum(
            "HUMAN", "IMPORTED", "AI_GENERATED", name="generationtype", native_enum=False,
        ), nullable=False),
        sa.Column("verification_status", sa.Enum(
            "PENDING", "VERIFIED", "FLAGGED", "REJECTED",
            name="verificationstatus", native_enum=False,
        ), nullable=False),
        sa.Column("normalized_hash", sa.String(64), nullable=False, unique=True),
        _created(),
        _updated(),
    )
    op.create_index(
        "ix_practice_questions_filter", "practice_questions",
        ["subject_id", "verification_status", "difficulty"],
    )
    op.create_table(
        "practice_question_options",
        _id(),
        sa.Column("question_id", sa.Uuid(), sa.ForeignKey("practice_questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("option_key", sa.String(8), nullable=False),
        sa.Column("option_text", sa.Text(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.UniqueConstraint("question_id", "option_key"),
        sa.UniqueConstraint("question_id", "order_index"),
    )
    op.create_index("ix_practice_question_options_question_id", "practice_question_options", ["question_id"])
    op.create_table(
        "practice_exams",
        _id(),
        sa.Column("subject_id", sa.Uuid(), sa.ForeignKey("practice_subjects.id"), nullable=False),
        sa.Column("owner_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("title", sa.String(250), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("kind", sa.String(30), nullable=False),
        sa.Column("time_limit_seconds", sa.Integer()),
        sa.Column("is_published", sa.Boolean(), nullable=False),
        _created(),
        _updated(),
    )
    op.create_index("ix_practice_exams_subject_id", "practice_exams", ["subject_id"])
    op.create_table(
        "practice_exam_questions",
        sa.Column("exam_id", sa.Uuid(), sa.ForeignKey("practice_exams.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("question_id", sa.Uuid(), sa.ForeignKey("practice_questions.id"), primary_key=True),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.UniqueConstraint("exam_id", "order_index"),
    )
    op.create_table(
        "practice_attempts",
        _id(),
        sa.Column("exam_id", sa.Uuid(), sa.ForeignKey("practice_exams.id"), nullable=False),
        sa.Column("subject_id", sa.Uuid(), sa.ForeignKey("practice_subjects.id"), nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.Enum(
            "IN_PROGRESS", "SUBMITTED", name="practiceattemptstatus", native_enum=False,
        ), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deadline_at", sa.DateTime(timezone=True)),
        sa.Column("submitted_at", sa.DateTime(timezone=True)),
        sa.Column("score", sa.Float()),
        sa.Column("correct_count", sa.Integer()),
        sa.Column("incorrect_count", sa.Integer()),
        sa.Column("unanswered_count", sa.Integer()),
    )
    op.create_index("ix_practice_attempts_user_started", "practice_attempts", ["user_id", "started_at"])
    op.create_table(
        "practice_attempt_questions",
        _id(),
        sa.Column("attempt_id", sa.Uuid(), sa.ForeignKey("practice_attempts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", sa.Uuid(), sa.ForeignKey("practice_questions.id"), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("marked_for_review", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("attempt_id", "order_index"),
        sa.UniqueConstraint("attempt_id", "question_id"),
    )
    op.create_index("ix_practice_attempt_questions_attempt_id", "practice_attempt_questions", ["attempt_id"])
    op.create_table(
        "practice_attempt_answers",
        _id(),
        sa.Column(
            "attempt_question_id", sa.Uuid(),
            sa.ForeignKey("practice_attempt_questions.id", ondelete="CASCADE"), nullable=False, unique=True,
        ),
        sa.Column("selected_keys", sa.JSON(), nullable=False),
        sa.Column("is_correct", sa.Boolean()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "practice_question_reports",
        _id(),
        sa.Column("question_id", sa.Uuid(), sa.ForeignKey("practice_questions.id"), nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reason", sa.String(40), nullable=False),
        sa.Column("comment", sa.Text()),
        _created(),
    )


def downgrade() -> None:
    for table in (
        "practice_question_reports",
        "practice_attempt_answers",
        "practice_attempt_questions",
        "practice_attempts",
        "practice_exam_questions",
        "practice_exams",
        "practice_question_options",
        "practice_questions",
        "practice_topics",
        "practice_chapters",
        "practice_subjects",
    ):
        op.drop_table(table)
