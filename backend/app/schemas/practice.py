import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.practice import PracticeAttemptStatus, PracticeQuestionType


class PracticeOptionPublic(BaseModel):
    key: str
    text: str


class PracticeQuestionPublic(BaseModel):
    id: uuid.UUID
    question_id: uuid.UUID
    order_index: int
    text: str
    question_type: PracticeQuestionType
    difficulty: str
    chapter: str | None
    topic: str | None
    options: list[PracticeOptionPublic]
    selected_keys: list[str]
    marked_for_review: bool


class PracticeSubjectSummary(BaseModel):
    id: uuid.UUID
    name: str
    code: str | None
    question_count: int
    exam_count: int
    completed_exams: int
    latest_score: float | None
    best_score: float | None


class PracticeChapterSummary(BaseModel):
    id: uuid.UUID
    title: str
    topics: list["PracticeTopicSummary"]


class PracticeTopicSummary(BaseModel):
    id: uuid.UUID
    title: str


class PracticeExamSummary(BaseModel):
    id: uuid.UUID
    subject_id: uuid.UUID
    title: str
    description: str | None
    kind: str
    question_count: int
    time_limit_seconds: int | None


class PracticeRandomRequest(BaseModel):
    subject_id: uuid.UUID
    chapter_id: uuid.UUID | None = None
    topic_id: uuid.UUID | None = None
    question_count: int = Field(default=10, ge=1, le=50)
    difficulty: Literal["easy", "medium", "hard"] | None = None
    time_limit_minutes: int | None = Field(default=None, ge=5, le=180)


class PracticeAnswerSave(BaseModel):
    selected_keys: list[str] = Field(default_factory=list, max_length=12)
    marked_for_review: bool = False


class PracticeAttemptView(BaseModel):
    id: uuid.UUID
    exam_id: uuid.UUID
    subject_id: uuid.UUID
    exam_title: str
    status: PracticeAttemptStatus
    started_at: datetime
    deadline_at: datetime | None
    questions: list[PracticeQuestionPublic]


class PracticeQuestionReview(BaseModel):
    id: uuid.UUID
    question_id: uuid.UUID
    text: str
    selected_keys: list[str]
    correct_keys: list[str]
    options: list[PracticeOptionPublic]
    is_correct: bool
    explanation: str
    source_name: str
    source_url: str | None
    topic: str | None


class PracticeResult(BaseModel):
    attempt_id: uuid.UUID
    exam_id: uuid.UUID
    subject_id: uuid.UUID
    score: float
    correct: int
    incorrect: int
    unanswered: int
    accuracy: float
    duration_seconds: int
    submitted_at: datetime
    questions: list[PracticeQuestionReview]


class PracticeHistoryItem(BaseModel):
    attempt_id: uuid.UUID
    exam_id: uuid.UUID
    subject_id: uuid.UUID
    exam_title: str
    score: float
    submitted_at: datetime


class PracticeTopicAccuracy(BaseModel):
    topic: str
    answered: int
    correct: int
    accuracy: float


class PracticeQuestionReportCreate(BaseModel):
    question_id: uuid.UUID
    reason: Literal[
        "wrong_answer",
        "unclear",
        "multiple_correct",
        "wrong_explanation",
        "duplicate",
        "outdated",
    ]
    comment: str | None = Field(default=None, max_length=1000)
