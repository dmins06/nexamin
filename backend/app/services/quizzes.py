import uuid
from collections import defaultdict
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.providers.base import LLMProvider
from app.core.exceptions import AppError
from app.models import (
    Activity,
    ActivityType,
    AttemptAnswer,
    Question,
    QuestionType,
    Quiz,
    QuizAttempt,
    TopicMastery,
)
from app.repositories.scoped import owned_course, owned_quiz
from app.schemas import (
    GeneratedQuiz,
    GradedAnswer,
    QuizGenerateRequest,
    QuizResult,
    QuizSubmitRequest,
)


def answers_match(question_type: QuestionType, expected: str, actual: str) -> bool:
    expected_norm = " ".join(expected.casefold().split())
    actual_norm = " ".join(actual.casefold().split())
    if question_type in {QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE}:
        return expected_norm == actual_norm
    return expected_norm == actual_norm


def mastery_score(correct: int, answered: int) -> float:
    if answered <= 0:
        return 0.0
    accuracy = correct / answered
    confidence = min(answered / 20, 1.0)
    return round(100 * accuracy * (0.7 + 0.3 * confidence), 2)


class QuizService:
    def __init__(self, session: AsyncSession, user_id: uuid.UUID, llm: LLMProvider):
        self.session = session
        self.user_id = user_id
        self.llm = llm

    async def generate(self, payload: QuizGenerateRequest) -> Quiz:
        await owned_course(self.session, payload.course_id, self.user_id)
        prompt = (
            f"Tạo {payload.question_count} câu hỏi {payload.difficulty.value} về {payload.topic}. "
            "Các câu phải rõ ràng, có giải thích. Với multiple_choice, cung cấp đúng 4 options."
        )
        generated = await self.llm.structured_generate(prompt, GeneratedQuiz)
        if len(generated.questions) != payload.question_count:
            raise AppError("INVALID_AI_OUTPUT", "AI returned an unexpected question count", 502)
        quiz = Quiz(
            course_id=payload.course_id,
            user_id=self.user_id,
            title=generated.title,
            difficulty=payload.difficulty,
        )
        self.session.add(quiz)
        await self.session.flush()
        for item in generated.questions:
            self.session.add(Question(quiz_id=quiz.id, **item.model_dump()))
        await self.session.commit()
        await self.session.refresh(quiz)
        return quiz

    async def submit(self, quiz_id: uuid.UUID, payload: QuizSubmitRequest) -> QuizResult:
        quiz = await owned_quiz(self.session, quiz_id, self.user_id)
        questions = list(
            (await self.session.scalars(select(Question).where(Question.quiz_id == quiz.id))).all()
        )
        by_id = {question.id: question for question in questions}
        if len(payload.answers) != len(questions) or {
            item.question_id for item in payload.answers
        } != set(by_id):
            raise AppError(
                "INCOMPLETE_ATTEMPT", "Submit exactly one answer for every quiz question", 422
            )
        attempt = QuizAttempt(quiz_id=quiz.id, user_id=self.user_id)
        self.session.add(attempt)
        await self.session.flush()
        graded: list[GradedAnswer] = []
        per_topic: dict[str, list[bool]] = defaultdict(list)
        for item in payload.answers:
            question = by_id[item.question_id]
            is_correct = answers_match(question.type, question.correct_answer, item.user_answer)
            per_topic[question.topic].append(is_correct)
            self.session.add(
                AttemptAnswer(
                    attempt_id=attempt.id,
                    question_id=question.id,
                    user_answer=item.user_answer,
                    is_correct=is_correct,
                )
            )
            graded.append(
                GradedAnswer(
                    question_id=question.id,
                    is_correct=is_correct,
                    explanation=question.explanation,
                    correct_answer=question.correct_answer,
                )
            )
        correct = sum(item.is_correct for item in graded)
        attempt.score = round(correct / len(questions) * 100, 2)
        attempt.completed_at = datetime.now(UTC)
        for topic, results in per_topic.items():
            row = await self.session.get(TopicMastery, (self.user_id, quiz.course_id, topic))
            if row is None:
                row = TopicMastery(user_id=self.user_id, course_id=quiz.course_id, topic=topic)
                self.session.add(row)
            row.questions_answered += len(results)
            row.correct_answers += sum(results)
            row.mastery_score = mastery_score(row.correct_answers, row.questions_answered)
            row.last_practiced_at = datetime.now(UTC)
        self.session.add(
            Activity(
                user_id=self.user_id,
                type=ActivityType.QUIZ_COMPLETED,
                entity_id=quiz.id,
                activity_metadata={"score": attempt.score},
            )
        )
        await self.session.commit()
        return QuizResult(attempt_id=attempt.id, score=attempt.score, answers=graded)
