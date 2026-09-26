"""Reusable practice question bank, exams, and immutable attempt snapshots."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.entities import TimestampMixin, UUIDMixin


class PracticeQuestionType(str, enum.Enum):
    SINGLE_CHOICE = "single_choice"
    MULTIPLE_CHOICE = "multiple_choice"
    TRUE_FALSE = "true_false"
    SHORT_ANSWER = "short_answer"
    MATCHING = "matching"
    FILL_BLANK = "fill_blank"
    CODING = "coding"


class GenerationType(str, enum.Enum):
    HUMAN = "human"
    IMPORTED = "imported"
    AI_GENERATED = "ai_generated"


class VerificationStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    FLAGGED = "flagged"
    REJECTED = "rejected"


class PracticeAttemptStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"


class PracticeSubject(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "practice_subjects"

    name: Mapped[str] = mapped_column(String(200), unique=True)
    code: Mapped[str | None] = mapped_column(String(40), unique=True)
    description: Mapped[str | None] = mapped_column(Text)


class PracticeChapter(UUIDMixin, Base):
    __tablename__ = "practice_chapters"
    __table_args__ = (UniqueConstraint("subject_id", "title"),)

    subject_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("practice_subjects.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(250))
    order_index: Mapped[int] = mapped_column(Integer, default=0)


class PracticeTopic(UUIDMixin, Base):
    __tablename__ = "practice_topics"
    __table_args__ = (UniqueConstraint("chapter_id", "title"),)

    chapter_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("practice_chapters.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(250))
    order_index: Mapped[int] = mapped_column(Integer, default=0)


class PracticeQuestion(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "practice_questions"
    __table_args__ = (
        UniqueConstraint("normalized_hash"),
        Index("ix_practice_questions_filter", "subject_id", "verification_status", "difficulty"),
    )

    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("practice_subjects.id"))
    chapter_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("practice_chapters.id"))
    topic_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("practice_topics.id"))
    question_text: Mapped[str] = mapped_column(Text)
    question_type: Mapped[PracticeQuestionType] = mapped_column(
        Enum(PracticeQuestionType, native_enum=False)
    )
    difficulty: Mapped[str] = mapped_column(String(12))
    explanation: Mapped[str] = mapped_column(Text)
    source_name: Mapped[str] = mapped_column(String(250))
    source_url: Mapped[str | None] = mapped_column(String(1000))
    source_license: Mapped[str] = mapped_column(String(120))
    source_type: Mapped[str] = mapped_column(String(40))
    retrieved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    generation_type: Mapped[GenerationType] = mapped_column(
        Enum(GenerationType, native_enum=False)
    )
    verification_status: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus, native_enum=False), default=VerificationStatus.PENDING
    )
    normalized_hash: Mapped[str] = mapped_column(String(64))


class PracticeQuestionOption(UUIDMixin, Base):
    __tablename__ = "practice_question_options"
    __table_args__ = (
        UniqueConstraint("question_id", "option_key", name="uq_pqo_question_option_key"),
        UniqueConstraint("question_id", "order_index", name="uq_pqo_question_order"),
    )

    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("practice_questions.id", ondelete="CASCADE"), index=True
    )
    option_key: Mapped[str] = mapped_column(String(8))
    option_text: Mapped[str] = mapped_column(Text)
    is_correct: Mapped[bool] = mapped_column(Boolean)
    order_index: Mapped[int] = mapped_column(Integer)


class PracticeExam(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "practice_exams"

    subject_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("practice_subjects.id"), index=True
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(250))
    description: Mapped[str | None] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(30), default="curated")
    time_limit_seconds: Mapped[int | None] = mapped_column(Integer)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)


class PracticeExamQuestion(Base):
    __tablename__ = "practice_exam_questions"
    __table_args__ = (UniqueConstraint("exam_id", "order_index"),)

    exam_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("practice_exams.id", ondelete="CASCADE"), primary_key=True
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("practice_questions.id"), primary_key=True
    )
    order_index: Mapped[int] = mapped_column(Integer)


class PracticeAttempt(UUIDMixin, Base):
    __tablename__ = "practice_attempts"
    __table_args__ = (Index("ix_practice_attempts_user_started", "user_id", "started_at"),)

    exam_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("practice_exams.id"))
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("practice_subjects.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    status: Mapped[PracticeAttemptStatus] = mapped_column(
        Enum(PracticeAttemptStatus, native_enum=False), default=PracticeAttemptStatus.IN_PROGRESS
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    score: Mapped[float | None] = mapped_column(Float)
    correct_count: Mapped[int | None] = mapped_column(Integer)
    incorrect_count: Mapped[int | None] = mapped_column(Integer)
    unanswered_count: Mapped[int | None] = mapped_column(Integer)


class PracticeAttemptQuestion(UUIDMixin, Base):
    __tablename__ = "practice_attempt_questions"
    __table_args__ = (
        UniqueConstraint("attempt_id", "order_index", name="uq_paq_attempt_order"),
        UniqueConstraint("attempt_id", "question_id", name="uq_paq_attempt_question"),
    )

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("practice_attempts.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("practice_questions.id"))
    order_index: Mapped[int] = mapped_column(Integer)
    snapshot: Mapped[dict[str, object]] = mapped_column(JSON)
    marked_for_review: Mapped[bool] = mapped_column(Boolean, default=False)


class PracticeAttemptAnswer(UUIDMixin, Base):
    __tablename__ = "practice_attempt_answers"
    __table_args__ = (UniqueConstraint("attempt_question_id"),)

    attempt_question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("practice_attempt_questions.id", ondelete="CASCADE")
    )
    selected_keys: Mapped[list[str]] = mapped_column(JSON, default=list)
    is_correct: Mapped[bool | None] = mapped_column(Boolean)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PracticeQuestionReport(UUIDMixin, Base):
    __tablename__ = "practice_question_reports"

    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("practice_questions.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    reason: Mapped[str] = mapped_column(String(40))
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
