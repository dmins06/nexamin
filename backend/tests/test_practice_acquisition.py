import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError
from app.models.practice import PracticeImportRun, PracticeQuestion, PracticeSubject, QuestionSource
from app.services.practice_acquisition import extract_questions, extract_text
from app.services.practice_import import QuestionPackage, import_package
from app.services.practice_sources import SourceCandidate, approve_source, register_candidate
from app.services.practice_subjects import resolve_subject


def test_extracts_answered_and_unanswered_questions_without_guessing() -> None:
    material = """Câu 1: Chủ nghĩa duy vật biện chứng nghiên cứu điều gì?
A. Một lĩnh vực riêng
B. Những quy luật chung
Đáp án: B

Câu 2: Phân tích mối quan hệ giữa vật chất và ý thức?
"""
    questions = extract_questions(material)
    assert len(questions) == 2
    assert questions[0].options[1].correct is True
    assert questions[1].type == "short_answer"
    assert questions[1].options == []
    assert "Câu 1" in extract_text(f"<main><p>{material}</p></main>".encode(), "review.html")


@pytest.mark.asyncio
async def test_subject_alias_and_approved_source_import_are_idempotent(session: AsyncSession) -> None:
    first = await resolve_subject(session, "Triết học Mác-Lênin")
    second = await resolve_subject(session, "Triết học Marx – Lenin")
    assert first.id == second.id
    candidate = SourceCandidate(
        name="Open teaching questions",
        url="https://example.org/review.html",
        source_type="oer",
        subject_hint="Triết học Mác – Lênin",
    )
    source = await register_candidate(session, candidate)
    assert (await register_candidate(session, candidate)).id == source.id
    assert source.import_status == "candidate"
    payload = {
        "subject_name": "Triết học Marx – Lenin",
        "source": {
            "name": source.name, "url": source.url, "license": "CC BY 4.0",
            "source_type": "open_educational", "reuse_confirmed": True,
            "source_id": str(source.id),
        },
        "questions": [{
            "external_id": "1", "text": "Chủ nghĩa duy vật biện chứng nghiên cứu điều gì?",
            "type": "single_choice", "difficulty": "medium", "options": [
                {"key": "A", "text": "Một lĩnh vực riêng", "correct": False},
                {"key": "B", "text": "Những quy luật chung", "correct": True},
            ],
        }],
    }
    package = QuestionPackage.model_validate(payload)
    with pytest.raises(AppError, match="chưa được duyệt"):
        await import_package(session, package)
    await approve_source(session, source, "CC BY 4.0", "https://example.org/license")
    assert await import_package(session, package) == (1, 0)
    assert await import_package(session, package) == (0, 1)
    question = (await session.scalars(select(PracticeQuestion))).one()
    assert question.source_id == source.id
    assert question.source_external_id == "1"
    assert question.verification_status.value == "pending"
    assert (await session.scalar(select(func.count()).select_from(PracticeImportRun))) == 1
    assert (await session.scalar(select(func.count()).select_from(PracticeSubject))) == 1
    assert (await session.scalar(select(func.count()).select_from(QuestionSource))) == 1


@pytest.mark.asyncio
async def test_external_url_without_registry_is_rejected(session: AsyncSession) -> None:
    package = QuestionPackage.model_validate({
        "subject_name": "Triết học Mác – Lênin",
        "source": {
            "name": "Unknown website", "url": "https://example.org/questions",
            "license": "CC BY 4.0", "source_type": "open_educational",
            "reuse_confirmed": True,
        },
        "questions": [{
            "text": "Trình bày đối tượng nghiên cứu của triết học Mác – Lênin?",
            "type": "short_answer", "difficulty": "medium",
        }],
    })
    with pytest.raises(AppError, match="đăng ký và duyệt"):
        await import_package(session, package)
