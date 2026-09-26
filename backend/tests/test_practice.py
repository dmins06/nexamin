import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError
from app.models import User
from app.models.practice import (
    GenerationType,
    PracticeExam,
    PracticeExamQuestion,
    PracticeQuestion,
    PracticeQuestionOption,
    PracticeQuestionType,
    PracticeSubject,
    VerificationStatus,
)
from app.schemas.practice import PracticeAnswerSave, PracticeRandomRequest
from app.services.practice import PracticeService, normalized_question_hash


async def make_exam(session: AsyncSession) -> tuple[PracticeSubject, PracticeExam, PracticeQuestion]:
    subject = PracticeSubject(name="Machine Learning", code="ML")
    session.add(subject)
    await session.flush()
    question = PracticeQuestion(
        subject_id=subject.id,
        question_text="Thuật toán nào dùng cây quyết định?",
        question_type=PracticeQuestionType.SINGLE_CHOICE,
        difficulty="easy",
        explanation="Cây quyết định phân nhánh theo thuộc tính.",
        source_name="Tài liệu mẫu được duyệt",
        source_license="Tác giả cho phép",
        source_type="user_provided",
        generation_type=GenerationType.HUMAN,
        verification_status=VerificationStatus.VERIFIED,
        normalized_hash=normalized_question_hash(subject.id, "Thuật toán nào dùng cây quyết định?"),
    )
    session.add(question)
    await session.flush()
    session.add_all([
        PracticeQuestionOption(question_id=question.id, option_key="A", option_text="Decision Tree", is_correct=True, order_index=0),
        PracticeQuestionOption(question_id=question.id, option_key="B", option_text="K-means", is_correct=False, order_index=1),
    ])
    exam = PracticeExam(subject_id=subject.id, title="Đề cơ bản", kind="curated", is_published=True)
    session.add(exam)
    await session.flush()
    session.add(PracticeExamQuestion(exam_id=exam.id, question_id=question.id, order_index=0))
    await session.commit()
    return subject, exam, question


@pytest.mark.asyncio
async def test_answer_is_hidden_until_submit_and_snapshot_is_stable(
    session: AsyncSession, users: tuple[User, User]
) -> None:
    first, _ = users
    _, exam, question = await make_exam(session)
    service = PracticeService(session, first.id)
    started = await service.start(exam.id)
    assert started.questions[0].options[0].key == "A"
    assert "is_correct" not in started.model_dump_json()
    assert "Cây quyết định phân nhánh" not in started.model_dump_json()
    with pytest.raises(AppError, match="Hãy nộp bài"):
        await service.result(started.id)
    question.explanation = "Giải thích mới, không được đổi kết quả cũ."
    await session.commit()
    await service.save_answer(
        started.id, started.questions[0].id, PracticeAnswerSave(selected_keys=["A"])
    )
    result = await service.submit(started.id)
    assert result.score == 10
    assert result.correct == 1
    assert result.questions[0].correct_keys == ["A"]
    assert result.questions[0].explanation == "Cây quyết định phân nhánh theo thuộc tính."
    with pytest.raises(AppError, match="đã nộp"):
        await service.submit(started.id)


@pytest.mark.asyncio
async def test_practice_attempt_owner_and_server_grading(
    session: AsyncSession, users: tuple[User, User]
) -> None:
    first, second = users
    _, exam, _ = await make_exam(session)
    owner = PracticeService(session, first.id)
    started = await owner.start(exam.id)
    with pytest.raises(AppError, match="Không tìm thấy"):
        await PracticeService(session, second.id).load(started.id)
    with pytest.raises(AppError, match="không hợp lệ"):
        await owner.save_answer(
            started.id, started.questions[0].id, PracticeAnswerSave(selected_keys=["Z"])
        )
    await owner.save_answer(
        started.id, started.questions[0].id, PracticeAnswerSave(selected_keys=["B"])
    )
    result = await owner.submit(started.id)
    assert (result.score, result.correct, result.incorrect, result.unanswered) == (0, 0, 1, 0)
    mistake_exam = await owner.create_mistakes_exam(started.id)
    assert mistake_exam.question_count == 1
    assert (await owner.start(mistake_exam.id)).questions[0].question_id == result.questions[0].question_id
    with pytest.raises(AppError, match="Không tìm thấy"):
        await PracticeService(session, second.id).create_mistakes_exam(started.id)


@pytest.mark.asyncio
async def test_random_exam_uses_only_verified_questions(
    session: AsyncSession, users: tuple[User, User]
) -> None:
    first, _ = users
    subject, _, _ = await make_exam(session)
    service = PracticeService(session, first.id)
    with pytest.raises(AppError, match="Chỉ có 1 câu"):
        await service.create_random_exam(PracticeRandomRequest(subject_id=subject.id, question_count=2))
    created = await service.create_random_exam(
        PracticeRandomRequest(subject_id=subject.id, question_count=1)
    )
    assert created.kind == "random"
    assert created.question_count == 1
    assert (await service.start(created.id)).questions[0].text


def test_question_hash_normalizes_spacing_and_case() -> None:
    subject = uuid.uuid4()
    assert normalized_question_hash(subject, "  CÂU  hỏi  ") == normalized_question_hash(
        subject, "câu hỏi"
    )
