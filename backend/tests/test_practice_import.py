import pytest
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError
from app.models import User
from app.services.practice import PracticeService
from app.services.practice_import import QuestionPackage, import_package


def package_data() -> dict:
    return {
        "subject_name": "Cấu trúc dữ liệu",
        "subject_code": "CTDL",
        "source": {
            "name": "Bộ câu hỏi do giảng viên cung cấp",
            "url": None,
            "license": "Cho phép Nexamin sử dụng",
            "source_type": "user_provided",
            "reuse_confirmed": True,
        },
        "questions": [{
            "chapter": "Cây",
            "topic": "Cây nhị phân",
            "text": "Cây nhị phân có tối đa bao nhiêu nút con tại mỗi nút?",
            "type": "single_choice",
            "difficulty": "easy",
            "explanation": "Theo định nghĩa, mỗi nút có tối đa hai nút con.",
            "options": [
                {"key": "A", "text": "Hai", "correct": True},
                {"key": "B", "text": "Ba", "correct": False},
            ],
        }],
    }


@pytest.mark.asyncio
async def test_import_stays_pending_and_skips_duplicates(
    session: AsyncSession, users: tuple[User, User]
) -> None:
    package = QuestionPackage.model_validate(package_data())
    assert await import_package(session, package) == (1, 0)
    assert await import_package(session, package) == (0, 1)
    first, _ = users
    assert (await PracticeService(session, first.id).subjects())[0].question_count == 0


@pytest.mark.asyncio
async def test_import_requires_reuse_permission(session: AsyncSession) -> None:
    data = package_data()
    data["source"]["reuse_confirmed"] = False
    with pytest.raises(AppError, match="quyền sử dụng"):
        await import_package(session, QuestionPackage.model_validate(data))


def test_import_rejects_invalid_answer_key() -> None:
    data = package_data()
    data["questions"][0]["options"][1]["key"] = "A"
    with pytest.raises(ValidationError, match="trùng mã"):
        QuestionPackage.model_validate(data)


def test_import_rejects_non_https_source_url() -> None:
    data = package_data()
    data["source"]["url"] = "javascript:alert(1)"
    with pytest.raises(ValidationError, match="HTTPS"):
        QuestionPackage.model_validate(data)
