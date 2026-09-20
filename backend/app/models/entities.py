import enum
import uuid
from datetime import datetime
from typing import Any

from pgvector.sqlalchemy import Vector
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
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config import settings
from app.database import Base


class Role(str, enum.Enum):
    STUDENT = "student"
    ADMIN = "admin"


class Visibility(str, enum.Enum):
    PRIVATE = "private"
    SHARED = "shared"
    UNIVERSITY = "university"


class TopicStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class ProcessingStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class QuestionType(str, enum.Enum):
    MULTIPLE_CHOICE = "multiple_choice"
    TRUE_FALSE = "true_false"
    SHORT_ANSWER = "short_answer"


class Difficulty(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class DeadlineStatus(str, enum.Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class Priority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ActivityType(str, enum.Enum):
    DOCUMENT_UPLOADED = "document_uploaded"
    QUIZ_COMPLETED = "quiz_completed"
    COURSE_CREATED = "course_created"
    DEADLINE_COMPLETED = "deadline_completed"
    STUDY_SESSION = "study_session"


class FriendshipStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class UUIDMixin:
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)


class University(UUIDMixin, Base):
    __tablename__ = "universities"

    official_code: Mapped[str | None] = mapped_column(String(30), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    short_name: Mapped[str] = mapped_column(String(30), index=True)
    logo_url: Mapped[str | None] = mapped_column(String(1000))
    email_domain: Mapped[str | None] = mapped_column(String(255), unique=True)
    country: Mapped[str] = mapped_column(String(100), default="Vietnam")
    website: Mapped[str | None] = mapped_column(String(1000))
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(150))
    avatar_url: Mapped[str | None] = mapped_column(String(1000))
    university_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("universities.id"))
    major: Mapped[str | None] = mapped_column(String(300))
    student_year: Mapped[int | None] = mapped_column(Integer)
    bio: Mapped[str | None] = mapped_column(Text)
    role: Mapped[Role] = mapped_column(Enum(Role, native_enum=False), default=Role.STUDENT)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    university: Mapped[University | None] = relationship(lazy="joined")


class RefreshToken(UUIDMixin, Base):
    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    family_id: Mapped[uuid.UUID] = mapped_column(index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    replaced_by_hash: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Course(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "courses"
    __table_args__ = (Index("ix_courses_owner_name", "owner_id", "name"),)

    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    university_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("universities.id"))
    name: Mapped[str] = mapped_column(String(200))
    code: Mapped[str | None] = mapped_column(String(40))
    description: Mapped[str | None] = mapped_column(Text)
    semester: Mapped[str | None] = mapped_column(String(50))
    academic_year: Mapped[str | None] = mapped_column(String(20))
    color: Mapped[str | None] = mapped_column(String(20))
    icon: Mapped[str | None] = mapped_column(String(80))
    visibility: Mapped[Visibility] = mapped_column(
        Enum(Visibility, native_enum=False), default=Visibility.PRIVATE
    )


class CourseTopic(UUIDMixin, Base):
    __tablename__ = "course_topics"
    __table_args__ = (UniqueConstraint("course_id", "order_index"),)

    course_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(250))
    description: Mapped[str | None] = mapped_column(Text)
    order_index: Mapped[int] = mapped_column(Integer)
    status: Mapped[TopicStatus] = mapped_column(
        Enum(TopicStatus, native_enum=False), default=TopicStatus.NOT_STARTED
    )


class Document(UUIDMixin, Base):
    __tablename__ = "documents"
    __table_args__ = (Index("ix_documents_user_course", "user_id", "course_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True
    )
    filename: Mapped[str] = mapped_column(String(255))
    original_filename: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(120))
    size: Mapped[int] = mapped_column(Integer)
    storage_key: Mapped[str] = mapped_column(String(700), unique=True)
    processing_status: Mapped[ProcessingStatus] = mapped_column(
        Enum(ProcessingStatus, native_enum=False), default=ProcessingStatus.UPLOADED
    )
    processing_error: Mapped[str | None] = mapped_column(Text)
    page_count: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DocumentChunk(UUIDMixin, Base):
    __tablename__ = "document_chunks"
    __table_args__ = (
        UniqueConstraint("document_id", "chunk_index"),
        Index("ix_chunks_course_document", "course_id", "document_id"),
    )

    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True
    )
    content: Mapped[str] = mapped_column(Text)
    page_number: Mapped[int | None] = mapped_column(Integer)
    chunk_index: Mapped[int] = mapped_column(Integer)
    embedding: Mapped[list[float]] = mapped_column(Vector(settings.embedding_dimensions))
    chunk_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class Conversation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "conversations"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(250))


class Message(UUIDMixin, Base):
    __tablename__ = "messages"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[MessageRole] = mapped_column(Enum(MessageRole, native_enum=False))
    content: Mapped[str] = mapped_column(Text)
    message_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Quiz(UUIDMixin, Base):
    __tablename__ = "quizzes"

    course_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(250))
    difficulty: Mapped[Difficulty] = mapped_column(Enum(Difficulty, native_enum=False))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Question(UUIDMixin, Base):
    __tablename__ = "questions"

    quiz_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quizzes.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[QuestionType] = mapped_column(Enum(QuestionType, native_enum=False))
    question: Mapped[str] = mapped_column(Text)
    options: Mapped[list[str] | None] = mapped_column(JSON)
    correct_answer: Mapped[str] = mapped_column(Text)
    explanation: Mapped[str] = mapped_column(Text)
    topic: Mapped[str] = mapped_column(String(250), index=True)


class QuizAttempt(UUIDMixin, Base):
    __tablename__ = "quiz_attempts"

    quiz_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quizzes.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    score: Mapped[float | None] = mapped_column(Float)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AttemptAnswer(UUIDMixin, Base):
    __tablename__ = "attempt_answers"
    __table_args__ = (UniqueConstraint("attempt_id", "question_id"),)

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quiz_attempts.id", ondelete="CASCADE")
    )
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"))
    user_answer: Mapped[str] = mapped_column(Text)
    is_correct: Mapped[bool] = mapped_column(Boolean)


class TopicMastery(Base):
    __tablename__ = "topic_mastery"
    __table_args__ = (UniqueConstraint("user_id", "course_id", "topic"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True
    )
    topic: Mapped[str] = mapped_column(String(250), primary_key=True)
    mastery_score: Mapped[float] = mapped_column(Float, default=0)
    questions_answered: Mapped[int] = mapped_column(Integer, default=0)
    correct_answers: Mapped[int] = mapped_column(Integer, default=0)
    last_practiced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Deadline(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "deadlines"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("courses.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str] = mapped_column(String(250))
    description: Mapped[str | None] = mapped_column(Text)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    priority: Mapped[Priority] = mapped_column(
        Enum(Priority, native_enum=False), default=Priority.MEDIUM
    )
    status: Mapped[DeadlineStatus] = mapped_column(
        Enum(DeadlineStatus, native_enum=False), default=DeadlineStatus.TODO
    )


class CalendarEvent(UUIDMixin, Base):
    __tablename__ = "calendar_events"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("courses.id", ondelete="SET NULL")
    )
    title: Mapped[str] = mapped_column(String(250))
    description: Mapped[str | None] = mapped_column(Text)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    event_type: Mapped[str] = mapped_column(String(80))
    recurrence: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Activity(UUIDMixin, Base):
    __tablename__ = "activities"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[ActivityType] = mapped_column(Enum(ActivityType, native_enum=False), index=True)
    entity_id: Mapped[uuid.UUID | None]
    activity_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class Friendship(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "friendships"
    __table_args__ = (UniqueConstraint("user_a_id", "user_b_id"),)

    user_a_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    user_b_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    requested_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[FriendshipStatus] = mapped_column(
        Enum(FriendshipStatus, native_enum=False), default=FriendshipStatus.PENDING, index=True
    )


class DirectMessage(UUIDMixin, Base):
    __tablename__ = "direct_messages"
    __table_args__ = (
        Index("ix_direct_messages_pair_created", "sender_id", "recipient_id", "created_at"),
    )

    sender_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AIRequestLog(UUIDMixin, Base):
    __tablename__ = "ai_request_logs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    model: Mapped[str] = mapped_column(String(150))
    latency_ms: Mapped[int] = mapped_column(Integer)
    retrieved_chunks: Mapped[int] = mapped_column(Integer, default=0)
    input_tokens: Mapped[int | None] = mapped_column(Integer)
    output_tokens: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
