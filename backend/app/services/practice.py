"""Question-bank practice with server-side grading and historical snapshots."""

import hashlib
import random
import re
import unicodedata
import uuid
from collections import defaultdict
from datetime import UTC, datetime, timedelta

from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError
from app.models.practice import (
    PracticeAttempt,
    PracticeAttemptAnswer,
    PracticeAttemptQuestion,
    PracticeAttemptStatus,
    PracticeChapter,
    PracticeExam,
    PracticeExamQuestion,
    PracticeQuestion,
    PracticeQuestionOption,
    PracticeQuestionReport,
    PracticeQuestionType,
    PracticeSubject,
    PracticeTopic,
    VerificationStatus,
)
from app.schemas.practice import (
    PracticeAnswerSave,
    PracticeAttemptView,
    PracticeChapterSummary,
    PracticeExamSummary,
    PracticeHistoryItem,
    PracticeOptionPublic,
    PracticeQuestionPublic,
    PracticeQuestionReportCreate,
    PracticeQuestionReview,
    PracticeRandomRequest,
    PracticeResult,
    PracticeSubjectSummary,
    PracticeTopicAccuracy,
    PracticeTopicSummary,
)


class SnapshotOption(BaseModel):
    key: str
    text: str
    correct: bool


class QuestionSnapshot(BaseModel):
    question_id: uuid.UUID
    text: str
    question_type: PracticeQuestionType
    difficulty: str
    chapter: str | None
    topic: str | None
    explanation: str
    source_name: str
    source_url: str | None
    options: list[SnapshotOption]


def normalized_question_hash(subject_id: uuid.UUID, text: str) -> str:
    folded = unicodedata.normalize("NFD", unicodedata.normalize("NFKC", text).casefold().replace("đ", "d"))
    normalized = " ".join(re.findall(r"[a-z0-9]+", "".join(
        char for char in folded if not unicodedata.combining(char)
    )))
    return hashlib.sha256(f"{subject_id}:{normalized}".encode()).hexdigest()


def _snapshot(row: PracticeAttemptQuestion) -> QuestionSnapshot:
    return QuestionSnapshot.model_validate(row.snapshot)


class PracticeService:
    def __init__(self, session: AsyncSession, user_id: uuid.UUID) -> None:
        self.session = session
        self.user_id = user_id

    async def chapters(self, subject_id: uuid.UUID) -> list[PracticeChapterSummary]:
        if await self.session.get(PracticeSubject, subject_id) is None:
            raise AppError("SUBJECT_NOT_FOUND", "Không tìm thấy môn luyện đề.", 404)
        chapters = list((await self.session.scalars(
            select(PracticeChapter)
            .where(PracticeChapter.subject_id == subject_id)
            .order_by(PracticeChapter.order_index, PracticeChapter.title)
        )).all())
        topics = list((await self.session.scalars(
            select(PracticeTopic)
            .where(PracticeTopic.chapter_id.in_([chapter.id for chapter in chapters]))
            .order_by(PracticeTopic.order_index, PracticeTopic.title)
        )).all()) if chapters else []
        return [
            PracticeChapterSummary(
                id=chapter.id,
                title=chapter.title,
                topics=[
                    PracticeTopicSummary(id=topic.id, title=topic.title)
                    for topic in topics if topic.chapter_id == chapter.id
                ],
            )
            for chapter in chapters
        ]

    async def subjects(self) -> list[PracticeSubjectSummary]:
        subjects = list((await self.session.scalars(select(PracticeSubject).order_by(PracticeSubject.name))).all())
        question_counts: dict[uuid.UUID, int] = {
            subject_id: count for subject_id, count in (await self.session.execute(
                select(PracticeQuestion.subject_id, func.count(PracticeQuestion.id))
                .where(PracticeQuestion.verification_status == VerificationStatus.VERIFIED)
                .group_by(PracticeQuestion.subject_id)
            )).all()
        }
        exam_counts: dict[uuid.UUID, int] = {
            subject_id: count for subject_id, count in (await self.session.execute(
                select(PracticeExam.subject_id, func.count(PracticeExam.id))
                .where(
                    PracticeExam.is_published.is_(True),
                    or_(PracticeExam.owner_id.is_(None), PracticeExam.owner_id == self.user_id),
                )
                .group_by(PracticeExam.subject_id)
            )).all()
        }
        scores: dict[uuid.UUID, list[tuple[datetime, float]]] = defaultdict(list)
        attempts = (await self.session.execute(
            select(PracticeAttempt.subject_id, PracticeAttempt.submitted_at, PracticeAttempt.score)
            .where(
                PracticeAttempt.user_id == self.user_id,
                PracticeAttempt.status == PracticeAttemptStatus.SUBMITTED,
            )
        )).all()
        for subject_id, submitted_at, score in attempts:
            if submitted_at is not None and score is not None:
                scores[subject_id].append((submitted_at, score))
        summaries = []
        for subject in subjects:
            latest = max(scores[subject.id], key=lambda item: item[0], default=None)
            summaries.append(PracticeSubjectSummary(
                id=subject.id,
                name=subject.name,
                code=subject.code,
                question_count=question_counts.get(subject.id, 0),
                exam_count=exam_counts.get(subject.id, 0),
                completed_exams=len(scores[subject.id]),
                latest_score=latest[1] if latest is not None else None,
                best_score=max((score for _, score in scores[subject.id]), default=None),
            ))
        return summaries

    async def exams(self, subject_id: uuid.UUID) -> list[PracticeExamSummary]:
        if await self.session.get(PracticeSubject, subject_id) is None:
            raise AppError("SUBJECT_NOT_FOUND", "Không tìm thấy môn luyện đề.", 404)
        rows = list((await self.session.scalars(
            select(PracticeExam)
            .where(
                PracticeExam.subject_id == subject_id,
                PracticeExam.is_published.is_(True),
                or_(PracticeExam.owner_id.is_(None), PracticeExam.owner_id == self.user_id),
            )
            .order_by(PracticeExam.created_at.desc())
        )).all())
        counts: dict[uuid.UUID, int] = {
            exam_id: count for exam_id, count in (await self.session.execute(
            select(PracticeExamQuestion.exam_id, func.count(PracticeExamQuestion.question_id))
            .where(PracticeExamQuestion.exam_id.in_([row.id for row in rows]))
            .group_by(PracticeExamQuestion.exam_id)
        )).all()
        } if rows else {}
        return [
            PracticeExamSummary(
                id=row.id,
                subject_id=row.subject_id,
                title=row.title,
                description=row.description,
                kind=row.kind,
                question_count=counts.get(row.id, 0),
                time_limit_seconds=row.time_limit_seconds,
            )
            for row in rows
        ]

    async def create_random_exam(self, payload: PracticeRandomRequest) -> PracticeExamSummary:
        if await self.session.get(PracticeSubject, payload.subject_id) is None:
            raise AppError("SUBJECT_NOT_FOUND", "Không tìm thấy môn luyện đề.", 404)
        query = select(PracticeQuestion).where(
            PracticeQuestion.subject_id == payload.subject_id,
            PracticeQuestion.verification_status == VerificationStatus.VERIFIED,
            PracticeQuestion.question_type.in_(
                [
                    PracticeQuestionType.SINGLE_CHOICE,
                    PracticeQuestionType.MULTIPLE_CHOICE,
                    PracticeQuestionType.TRUE_FALSE,
                ]
            ),
        )
        if payload.chapter_id is not None:
            query = query.where(PracticeQuestion.chapter_id == payload.chapter_id)
        if payload.topic_id is not None:
            query = query.where(PracticeQuestion.topic_id == payload.topic_id)
        if payload.difficulty is not None:
            query = query.where(PracticeQuestion.difficulty == payload.difficulty)
        candidates = list((await self.session.scalars(query)).all())
        if len(candidates) < payload.question_count:
            raise AppError(
                "NOT_ENOUGH_QUESTIONS",
                f"Chỉ có {len(candidates)} câu đã duyệt phù hợp bộ lọc. Hãy giảm số câu hoặc đổi bộ lọc.",
                422,
            )
        chosen = random.SystemRandom().sample(candidates, payload.question_count)
        exam = PracticeExam(
            subject_id=payload.subject_id,
            owner_id=self.user_id,
            title=f"Đề ngẫu nhiên · {payload.question_count} câu",
            kind="random",
            time_limit_seconds=payload.time_limit_minutes * 60
            if payload.time_limit_minutes is not None else None,
            is_published=True,
        )
        self.session.add(exam)
        await self.session.flush()
        self.session.add_all([
            PracticeExamQuestion(exam_id=exam.id, question_id=question.id, order_index=index)
            for index, question in enumerate(chosen)
        ])
        await self.session.commit()
        return PracticeExamSummary(
            id=exam.id,
            subject_id=exam.subject_id,
            title=exam.title,
            description=exam.description,
            kind=exam.kind,
            question_count=len(chosen),
            time_limit_seconds=exam.time_limit_seconds,
        )

    async def create_mistakes_exam(self, attempt_id: uuid.UUID) -> PracticeExamSummary:
        attempt = await self._owned_attempt(attempt_id)
        if attempt.status != PracticeAttemptStatus.SUBMITTED:
            raise AppError("ATTEMPT_NOT_SUBMITTED", "Hãy nộp bài trước khi luyện câu sai.", 409)
        rows = (await self.session.execute(
            select(PracticeAttemptQuestion.question_id)
            .join(
                PracticeAttemptAnswer,
                PracticeAttemptAnswer.attempt_question_id == PracticeAttemptQuestion.id,
            )
            .where(
                PracticeAttemptQuestion.attempt_id == attempt.id,
                PracticeAttemptAnswer.is_correct.is_(False),
            )
            .order_by(PracticeAttemptQuestion.order_index)
        )).scalars().all()
        question_ids = list(dict.fromkeys(rows))
        questions = list((await self.session.scalars(
            select(PracticeQuestion).where(
                PracticeQuestion.id.in_(question_ids),
                PracticeQuestion.verification_status == VerificationStatus.VERIFIED,
            )
        )).all()) if question_ids else []
        available = {question.id for question in questions}
        ordered = [question_id for question_id in question_ids if question_id in available]
        if not ordered:
            raise AppError("NO_MISTAKES", "Không còn câu sai đã duyệt để luyện lại.", 422)
        exam = PracticeExam(
            subject_id=attempt.subject_id,
            owner_id=self.user_id,
            title=f"Luyện câu sai · {len(ordered)} câu",
            kind="mistakes",
            is_published=True,
        )
        self.session.add(exam)
        await self.session.flush()
        self.session.add_all([
            PracticeExamQuestion(exam_id=exam.id, question_id=question_id, order_index=index)
            for index, question_id in enumerate(ordered)
        ])
        await self.session.commit()
        return PracticeExamSummary(
            id=exam.id,
            subject_id=exam.subject_id,
            title=exam.title,
            description=exam.description,
            kind=exam.kind,
            question_count=len(ordered),
            time_limit_seconds=None,
        )

    async def start(self, exam_id: uuid.UUID) -> PracticeAttemptView:
        exam = await self.session.get(PracticeExam, exam_id)
        if (
            exam is None or not exam.is_published
            or exam.owner_id is not None and exam.owner_id != self.user_id
        ):
            raise AppError("EXAM_NOT_FOUND", "Không tìm thấy đề luyện phù hợp.", 404)
        question_rows = (await self.session.execute(
            select(PracticeQuestion, PracticeExamQuestion.order_index)
            .join(PracticeExamQuestion, PracticeExamQuestion.question_id == PracticeQuestion.id)
            .where(PracticeExamQuestion.exam_id == exam_id)
            .order_by(PracticeExamQuestion.order_index)
        )).all()
        if not question_rows or any(
            question.subject_id != exam.subject_id
            or question.verification_status != VerificationStatus.VERIFIED
            or question.question_type not in {
                PracticeQuestionType.SINGLE_CHOICE,
                PracticeQuestionType.MULTIPLE_CHOICE,
                PracticeQuestionType.TRUE_FALSE,
            }
            for question, _ in question_rows
        ):
            raise AppError("EXAM_UNAVAILABLE", "Đề chưa có đủ câu hỏi đã duyệt.", 409)
        now = datetime.now(UTC)
        attempt = PracticeAttempt(
            exam_id=exam.id,
            subject_id=exam.subject_id,
            user_id=self.user_id,
            status=PracticeAttemptStatus.IN_PROGRESS,
            started_at=now,
            deadline_at=now + timedelta(seconds=exam.time_limit_seconds)
            if exam.time_limit_seconds is not None else None,
        )
        self.session.add(attempt)
        await self.session.flush()
        for question, index in question_rows:
            options = list((await self.session.scalars(
                select(PracticeQuestionOption)
                .where(PracticeQuestionOption.question_id == question.id)
                .order_by(PracticeQuestionOption.order_index)
            )).all())
            correct_count = sum(option.is_correct for option in options)
            if not options or (
                question.question_type in {
                    PracticeQuestionType.SINGLE_CHOICE,
                    PracticeQuestionType.TRUE_FALSE,
                } and correct_count != 1
            ) or (question.question_type == PracticeQuestionType.MULTIPLE_CHOICE and correct_count < 1):
                raise AppError("EXAM_UNAVAILABLE", "Đề có câu hỏi chưa hợp lệ.", 409)
            chapter = await self.session.get(PracticeChapter, question.chapter_id) if question.chapter_id else None
            topic = await self.session.get(PracticeTopic, question.topic_id) if question.topic_id else None
            snapshot = QuestionSnapshot(
                question_id=question.id,
                text=question.question_text,
                question_type=question.question_type,
                difficulty=question.difficulty,
                chapter=chapter.title if chapter else None,
                topic=topic.title if topic else None,
                explanation=question.explanation,
                source_name=question.source_name,
                source_url=question.source_url,
                options=[
                    SnapshotOption(key=option.option_key, text=option.option_text, correct=option.is_correct)
                    for option in options
                ],
            )
            self.session.add(PracticeAttemptQuestion(
                attempt_id=attempt.id,
                question_id=question.id,
                order_index=index,
                snapshot=snapshot.model_dump(mode="json"),
            ))
        await self.session.commit()
        return await self.load(attempt.id)

    async def _owned_attempt(self, attempt_id: uuid.UUID, lock: bool = False) -> PracticeAttempt:
        query = select(PracticeAttempt).where(
            PracticeAttempt.id == attempt_id, PracticeAttempt.user_id == self.user_id
        )
        if lock:
            query = query.with_for_update()
        attempt = await self.session.scalar(query)
        if attempt is None:
            raise AppError("ATTEMPT_NOT_FOUND", "Không tìm thấy lượt làm bài.", 404)
        return attempt

    async def _attempt_questions(self, attempt_id: uuid.UUID) -> list[PracticeAttemptQuestion]:
        return list((await self.session.scalars(
            select(PracticeAttemptQuestion)
            .where(PracticeAttemptQuestion.attempt_id == attempt_id)
            .order_by(PracticeAttemptQuestion.order_index)
        )).all())

    async def load(self, attempt_id: uuid.UUID) -> PracticeAttemptView:
        attempt = await self._owned_attempt(attempt_id)
        if attempt.status == PracticeAttemptStatus.SUBMITTED:
            raise AppError("ATTEMPT_SUBMITTED", "Bài đã nộp. Hãy mở kết quả.", 409)
        exam = await self.session.get(PracticeExam, attempt.exam_id)
        if exam is None:
            raise AppError("EXAM_NOT_FOUND", "Không tìm thấy đề luyện.", 404)
        rows = await self._attempt_questions(attempt.id)
        answers = {
            answer.attempt_question_id: answer
            for answer in (await self.session.scalars(
                select(PracticeAttemptAnswer).where(
                    PracticeAttemptAnswer.attempt_question_id.in_([row.id for row in rows])
                )
            )).all()
        }
        questions = []
        for row in rows:
            snapshot = _snapshot(row)
            answer = answers.get(row.id)
            questions.append(PracticeQuestionPublic(
                id=row.id,
                question_id=snapshot.question_id,
                order_index=row.order_index,
                text=snapshot.text,
                question_type=snapshot.question_type,
                difficulty=snapshot.difficulty,
                chapter=snapshot.chapter,
                topic=snapshot.topic,
                options=[PracticeOptionPublic(key=option.key, text=option.text) for option in snapshot.options],
                selected_keys=answer.selected_keys if answer else [],
                marked_for_review=row.marked_for_review,
            ))
        return PracticeAttemptView(
            id=attempt.id,
            exam_id=exam.id,
            subject_id=attempt.subject_id,
            exam_title=exam.title,
            status=attempt.status,
            started_at=attempt.started_at,
            deadline_at=attempt.deadline_at,
            questions=questions,
        )

    async def save_answer(
        self, attempt_id: uuid.UUID, attempt_question_id: uuid.UUID, payload: PracticeAnswerSave
    ) -> None:
        attempt = await self._owned_attempt(attempt_id, lock=True)
        now = datetime.now(UTC)
        if attempt.status != PracticeAttemptStatus.IN_PROGRESS:
            raise AppError("ATTEMPT_SUBMITTED", "Bài đã nộp, không thể sửa đáp án.", 409)
        if attempt.deadline_at is not None and now >= attempt.deadline_at.replace(tzinfo=UTC):
            raise AppError("TIME_EXPIRED", "Đã hết giờ. Hãy nộp bài để xem kết quả.", 409)
        row = await self.session.scalar(select(PracticeAttemptQuestion).where(
            PracticeAttemptQuestion.id == attempt_question_id,
            PracticeAttemptQuestion.attempt_id == attempt.id,
        ))
        if row is None:
            raise AppError("QUESTION_NOT_FOUND", "Câu hỏi không thuộc bài làm này.", 404)
        snapshot = _snapshot(row)
        valid_keys = {option.key for option in snapshot.options}
        selected = payload.selected_keys
        if len(selected) != len(set(selected)) or not set(selected) <= valid_keys:
            raise AppError("INVALID_ANSWER", "Đáp án không hợp lệ.", 422)
        if snapshot.question_type != PracticeQuestionType.MULTIPLE_CHOICE and len(selected) > 1:
            raise AppError("INVALID_ANSWER", "Câu này chỉ chọn một đáp án.", 422)
        answer = await self.session.scalar(select(PracticeAttemptAnswer).where(
            PracticeAttemptAnswer.attempt_question_id == row.id
        ))
        if answer is None:
            answer = PracticeAttemptAnswer(attempt_question_id=row.id, selected_keys=selected)
            self.session.add(answer)
        else:
            answer.selected_keys = selected
        row.marked_for_review = payload.marked_for_review
        await self.session.commit()

    async def submit(self, attempt_id: uuid.UUID) -> PracticeResult:
        attempt = await self._owned_attempt(attempt_id, lock=True)
        if attempt.status != PracticeAttemptStatus.IN_PROGRESS:
            raise AppError("ATTEMPT_SUBMITTED", "Bài đã nộp trước đó.", 409)
        rows = await self._attempt_questions(attempt.id)
        if not rows:
            raise AppError("EMPTY_ATTEMPT", "Bài làm không có câu hỏi.", 409)
        answers = {
            answer.attempt_question_id: answer
            for answer in (await self.session.scalars(
                select(PracticeAttemptAnswer).where(
                    PracticeAttemptAnswer.attempt_question_id.in_([row.id for row in rows])
                )
            )).all()
        }
        correct = incorrect = unanswered = 0
        for row in rows:
            snapshot = _snapshot(row)
            answer = answers.get(row.id)
            selected = answer.selected_keys if answer else []
            correct_keys = {option.key for option in snapshot.options if option.correct}
            if not selected:
                unanswered += 1
            elif set(selected) == correct_keys:
                correct += 1
            else:
                incorrect += 1
            if answer is None:
                answer = PracticeAttemptAnswer(attempt_question_id=row.id, selected_keys=[])
                self.session.add(answer)
            answer.is_correct = bool(selected) and set(selected) == correct_keys
        attempt.status = PracticeAttemptStatus.SUBMITTED
        attempt.submitted_at = datetime.now(UTC)
        attempt.correct_count = correct
        attempt.incorrect_count = incorrect
        attempt.unanswered_count = unanswered
        attempt.score = round(correct / len(rows) * 10, 2)
        await self.session.commit()
        return await self.result(attempt.id)

    async def result(self, attempt_id: uuid.UUID) -> PracticeResult:
        attempt = await self._owned_attempt(attempt_id)
        if attempt.status != PracticeAttemptStatus.SUBMITTED or attempt.submitted_at is None:
            raise AppError("ATTEMPT_IN_PROGRESS", "Hãy nộp bài trước khi xem đáp án.", 409)
        rows = await self._attempt_questions(attempt.id)
        answers = {
            answer.attempt_question_id: answer
            for answer in (await self.session.scalars(
                select(PracticeAttemptAnswer).where(
                    PracticeAttemptAnswer.attempt_question_id.in_([row.id for row in rows])
                )
            )).all()
        }
        reviews = []
        for row in rows:
            snapshot = _snapshot(row)
            answer = answers.get(row.id)
            reviews.append(PracticeQuestionReview(
                id=row.id,
                question_id=snapshot.question_id,
                text=snapshot.text,
                selected_keys=answer.selected_keys if answer else [],
                correct_keys=[option.key for option in snapshot.options if option.correct],
                options=[PracticeOptionPublic(key=option.key, text=option.text) for option in snapshot.options],
                is_correct=bool(answer and answer.is_correct),
                explanation=snapshot.explanation,
                source_name=snapshot.source_name,
                source_url=snapshot.source_url,
                topic=snapshot.topic,
            ))
        started_at = attempt.started_at.replace(tzinfo=UTC)
        submitted_at = attempt.submitted_at.replace(tzinfo=UTC)
        correct = attempt.correct_count or 0
        return PracticeResult(
            attempt_id=attempt.id,
            exam_id=attempt.exam_id,
            subject_id=attempt.subject_id,
            score=attempt.score or 0,
            correct=correct,
            incorrect=attempt.incorrect_count or 0,
            unanswered=attempt.unanswered_count or 0,
            accuracy=round(correct / len(rows) * 100, 2) if rows else 0,
            duration_seconds=max(0, round((submitted_at - started_at).total_seconds())),
            submitted_at=attempt.submitted_at,
            questions=reviews,
        )

    async def history(self, subject_id: uuid.UUID | None = None) -> list[PracticeHistoryItem]:
        query = (
            select(PracticeAttempt, PracticeExam.title)
            .join(PracticeExam, PracticeExam.id == PracticeAttempt.exam_id)
            .where(
                PracticeAttempt.user_id == self.user_id,
                PracticeAttempt.status == PracticeAttemptStatus.SUBMITTED,
            )
            .order_by(PracticeAttempt.submitted_at.desc())
            .limit(100)
        )
        if subject_id is not None:
            query = query.where(PracticeAttempt.subject_id == subject_id)
        rows = (await self.session.execute(query)).all()
        return [
            PracticeHistoryItem(
                attempt_id=attempt.id,
                exam_id=attempt.exam_id,
                subject_id=attempt.subject_id,
                exam_title=title,
                score=attempt.score or 0,
                submitted_at=attempt.submitted_at or attempt.started_at,
            )
            for attempt, title in rows
        ]

    async def weak_topics(self, subject_id: uuid.UUID) -> list[PracticeTopicAccuracy]:
        rows = (await self.session.execute(
            select(PracticeAttemptQuestion.snapshot, PracticeAttemptAnswer.is_correct, PracticeAttemptAnswer.selected_keys)
            .join(PracticeAttempt, PracticeAttempt.id == PracticeAttemptQuestion.attempt_id)
            .join(PracticeAttemptAnswer, PracticeAttemptAnswer.attempt_question_id == PracticeAttemptQuestion.id)
            .where(
                PracticeAttempt.user_id == self.user_id,
                PracticeAttempt.subject_id == subject_id,
                PracticeAttempt.status == PracticeAttemptStatus.SUBMITTED,
            )
        )).all()
        counts: dict[str, list[int]] = defaultdict(lambda: [0, 0])
        for raw, is_correct, selected in rows:
            snapshot = QuestionSnapshot.model_validate(raw)
            if snapshot.topic is None or not selected:
                continue
            counts[snapshot.topic][0] += 1
            counts[snapshot.topic][1] += int(bool(is_correct))
        return sorted(
            [
                PracticeTopicAccuracy(
                    topic=topic,
                    answered=values[0],
                    correct=values[1],
                    accuracy=round(values[1] / values[0] * 100, 2),
                )
                for topic, values in counts.items()
            ],
            key=lambda item: (item.accuracy, -item.answered, item.topic),
        )

    async def report(self, payload: PracticeQuestionReportCreate) -> None:
        practiced = await self.session.scalar(
            select(PracticeAttemptQuestion.id)
            .join(PracticeAttempt, PracticeAttempt.id == PracticeAttemptQuestion.attempt_id)
            .where(
                PracticeAttempt.user_id == self.user_id,
                PracticeAttemptQuestion.question_id == payload.question_id,
                PracticeAttempt.status == PracticeAttemptStatus.SUBMITTED,
            )
            .limit(1)
        )
        if practiced is None:
            raise AppError("QUESTION_NOT_PRACTICED", "Bạn chỉ có thể báo lỗi câu đã làm.", 403)
        self.session.add(PracticeQuestionReport(
            question_id=payload.question_id,
            user_id=self.user_id,
            reason=payload.reason,
            comment=payload.comment,
        ))
        await self.session.commit()
