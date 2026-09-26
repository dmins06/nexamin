"""Validated local question-package importer; imported content stays pending review."""

from datetime import UTC, datetime
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError
from app.models.practice import (
    GenerationType,
    PracticeChapter,
    PracticeQuestion,
    PracticeQuestionOption,
    PracticeQuestionType,
    PracticeSubject,
    PracticeTopic,
    VerificationStatus,
)
from app.services.practice import normalized_question_hash


class SourcePackage(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=3, max_length=250)
    url: str | None = Field(default=None, max_length=1000)
    license: str = Field(min_length=3, max_length=120)
    source_type: Literal["open_educational", "public_domain", "licensed", "user_provided", "ai_generated"]
    reuse_confirmed: bool

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        parsed = urlsplit(value)
        if parsed.scheme != "https" or not parsed.netloc:
            raise ValueError("Liên kết nguồn phải dùng HTTPS.")
        return value


class ImportedOption(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    key: str = Field(min_length=1, max_length=8)
    text: str = Field(min_length=1, max_length=4000)
    correct: bool


class ImportedQuestion(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    chapter: str | None = Field(default=None, max_length=250)
    topic: str | None = Field(default=None, max_length=250)
    text: str = Field(min_length=10, max_length=12000)
    type: Literal["single_choice", "multiple_choice", "true_false"]
    difficulty: Literal["easy", "medium", "hard"]
    explanation: str = Field(min_length=10, max_length=12000)
    options: list[ImportedOption] = Field(min_length=2, max_length=8)

    @model_validator(mode="after")
    def validate_options(self) -> "ImportedQuestion":
        keys = [option.key for option in self.options]
        correct = sum(option.correct for option in self.options)
        if len(keys) != len(set(keys)):
            raise ValueError("Các phương án không được trùng mã.")
        if correct < 1 or (self.type != "multiple_choice" and correct != 1):
            raise ValueError("Số đáp án đúng không phù hợp loại câu hỏi.")
        if self.topic and not self.chapter:
            raise ValueError("Chủ đề phải thuộc một chương.")
        return self


class QuestionPackage(BaseModel):
    subject_name: str = Field(min_length=3, max_length=200)
    subject_code: str | None = Field(default=None, max_length=40)
    source: SourcePackage
    questions: list[ImportedQuestion] = Field(min_length=1, max_length=500)


async def import_package(session: AsyncSession, package: QuestionPackage) -> tuple[int, int]:
    """Import a permission-confirmed package; never publish questions automatically."""
    if not package.source.reuse_confirmed:
        raise AppError(
            "SOURCE_PERMISSION_REQUIRED",
            "Chưa xác nhận quyền sử dụng lại nguồn câu hỏi.",
            422,
        )
    subject = await session.scalar(
        select(PracticeSubject).where(PracticeSubject.name == package.subject_name)
    )
    if subject is None:
        subject = PracticeSubject(name=package.subject_name, code=package.subject_code)
        session.add(subject)
        await session.flush()
    added = skipped = 0
    chapter_cache: dict[str, PracticeChapter] = {}
    topic_cache: dict[tuple[str, str], PracticeTopic] = {}
    for item in package.questions:
        digest = normalized_question_hash(subject.id, item.text)
        if await session.scalar(
            select(PracticeQuestion.id).where(PracticeQuestion.normalized_hash == digest)
        ):
            skipped += 1
            continue
        chapter = None
        if item.chapter:
            chapter = chapter_cache.get(item.chapter)
            if chapter is None:
                chapter = await session.scalar(
                    select(PracticeChapter).where(
                        PracticeChapter.subject_id == subject.id,
                        PracticeChapter.title == item.chapter,
                    )
                )
                if chapter is None:
                    chapter = PracticeChapter(subject_id=subject.id, title=item.chapter)
                    session.add(chapter)
                    await session.flush()
                chapter_cache[item.chapter] = chapter
        topic = None
        if item.topic and chapter:
            key = (chapter.title, item.topic)
            topic = topic_cache.get(key)
            if topic is None:
                topic = await session.scalar(
                    select(PracticeTopic).where(
                        PracticeTopic.chapter_id == chapter.id,
                        PracticeTopic.title == item.topic,
                    )
                )
                if topic is None:
                    topic = PracticeTopic(chapter_id=chapter.id, title=item.topic)
                    session.add(topic)
                    await session.flush()
                topic_cache[key] = topic
        question = PracticeQuestion(
            subject_id=subject.id,
            chapter_id=chapter.id if chapter else None,
            topic_id=topic.id if topic else None,
            question_text=item.text,
            question_type=PracticeQuestionType(item.type),
            difficulty=item.difficulty,
            explanation=item.explanation,
            source_name=package.source.name,
            source_url=package.source.url,
            source_license=package.source.license,
            source_type=package.source.source_type,
            retrieved_at=datetime.now(UTC),
            generation_type=(
                GenerationType.AI_GENERATED
                if package.source.source_type == "ai_generated"
                else GenerationType.IMPORTED
            ),
            verification_status=VerificationStatus.PENDING,
            normalized_hash=digest,
        )
        session.add(question)
        await session.flush()
        session.add_all([
            PracticeQuestionOption(
                question_id=question.id,
                option_key=option.key,
                option_text=option.text,
                is_correct=option.correct,
                order_index=index,
            )
            for index, option in enumerate(item.options)
        ])
        added += 1
    await session.commit()
    return added, skipped
