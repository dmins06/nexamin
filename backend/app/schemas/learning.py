import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator

from app.models.entities import (
    DeadlineStatus,
    Difficulty,
    Priority,
    ProcessingStatus,
    QuestionType,
    TopicStatus,
    Visibility,
)
from app.schemas.common import ORMModel


class UniversityResponse(ORMModel):
    id: uuid.UUID
    official_code: str | None
    name: str
    short_name: str
    logo_url: str | None
    email_domain: str | None
    country: str
    website: str | None
    is_verified: bool
    created_at: datetime


class CourseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    code: str | None = Field(default=None, max_length=40)
    description: str | None = None
    university_id: uuid.UUID | None = None
    semester: str | None = Field(default=None, max_length=50)
    academic_year: str | None = Field(default=None, max_length=20)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    icon: str | None = Field(default=None, max_length=80)
    visibility: Visibility = Visibility.PRIVATE


class CourseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    code: str | None = Field(default=None, max_length=40)
    description: str | None = None
    semester: str | None = None
    academic_year: str | None = None
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    icon: str | None = None
    visibility: Visibility | None = None


class CourseResponse(ORMModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    university_id: uuid.UUID | None
    name: str
    code: str | None
    description: str | None
    semester: str | None
    academic_year: str | None
    color: str | None
    icon: str | None
    visibility: Visibility
    created_at: datetime
    updated_at: datetime


class TopicCreate(BaseModel):
    title: str = Field(min_length=1, max_length=250)
    description: str | None = None
    order_index: int = Field(ge=0)
    status: TopicStatus = TopicStatus.NOT_STARTED


class TopicResponse(TopicCreate, ORMModel):
    id: uuid.UUID
    course_id: uuid.UUID


class DocumentResponse(ORMModel):
    id: uuid.UUID
    user_id: uuid.UUID
    course_id: uuid.UUID
    filename: str
    original_filename: str
    mime_type: str
    size: int
    processing_status: ProcessingStatus
    processing_error: str | None
    page_count: int | None
    created_at: datetime


class ConversationCreate(BaseModel):
    course_id: uuid.UUID
    title: str = Field(min_length=1, max_length=250)


class ConversationResponse(ORMModel):
    id: uuid.UUID
    user_id: uuid.UUID
    course_id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime


class ChatRequest(BaseModel):
    course_id: uuid.UUID
    conversation_id: uuid.UUID | None = None
    message: str = Field(min_length=1, max_length=8000)


class Citation(BaseModel):
    document_id: uuid.UUID
    filename: str
    page: int | None
    chunk_id: uuid.UUID


class ChatResponse(BaseModel):
    answer: str
    conversation_id: uuid.UUID
    citations: list[Citation]


class QuizGenerateRequest(BaseModel):
    course_id: uuid.UUID
    topic: str = Field(min_length=1, max_length=250)
    difficulty: Difficulty = Difficulty.MEDIUM
    question_count: int = Field(default=10, ge=1, le=30)


class QuestionPublic(ORMModel):
    id: uuid.UUID
    type: QuestionType
    question: str
    options: list[str] | None
    topic: str


class QuizResponse(ORMModel):
    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    difficulty: Difficulty
    created_at: datetime
    questions: list[QuestionPublic] = []


class AnswerSubmission(BaseModel):
    question_id: uuid.UUID
    user_answer: str = Field(max_length=4000)


class QuizSubmitRequest(BaseModel):
    answers: list[AnswerSubmission] = Field(min_length=1)


class GradedAnswer(BaseModel):
    question_id: uuid.UUID
    is_correct: bool
    explanation: str
    correct_answer: str


class QuizResult(BaseModel):
    attempt_id: uuid.UUID
    score: float
    answers: list[GradedAnswer]


class DeadlineCreate(BaseModel):
    course_id: uuid.UUID | None = None
    title: str = Field(min_length=1, max_length=250)
    description: str | None = None
    due_at: datetime
    priority: Priority = Priority.MEDIUM
    status: DeadlineStatus = DeadlineStatus.TODO


class DeadlineUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=250)
    description: str | None = None
    due_at: datetime | None = None
    priority: Priority | None = None
    status: DeadlineStatus | None = None


class DeadlineResponse(DeadlineCreate, ORMModel):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class EventCreate(BaseModel):
    course_id: uuid.UUID | None = None
    title: str = Field(min_length=1, max_length=250)
    description: str | None = None
    start_at: datetime
    end_at: datetime
    event_type: str = Field(max_length=80)
    recurrence: dict[str, Any] | None = None

    @model_validator(mode="after")
    def valid_interval(self) -> "EventCreate":
        if self.end_at <= self.start_at:
            raise ValueError("end_at must be after start_at")
        return self


class EventResponse(EventCreate, ORMModel):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime


class TopicMasteryResponse(ORMModel):
    course_id: uuid.UUID
    topic: str
    mastery_score: float
    questions_answered: int
    correct_answers: int
    last_practiced_at: datetime | None


class DashboardResponse(BaseModel):
    courses_count: int
    upcoming_deadlines_count: int
    documents_count: int
    weekly_progress: int
    upcoming_deadlines: list[DeadlineResponse]
    course_progress: list[TopicMasteryResponse]
    recent_activity: list[dict[str, Any]]


class GeneratedQuestion(BaseModel):
    type: QuestionType
    question: str
    options: list[str] | None = None
    correct_answer: str
    explanation: str
    topic: str


class GeneratedQuiz(BaseModel):
    title: str
    questions: list[GeneratedQuestion]
