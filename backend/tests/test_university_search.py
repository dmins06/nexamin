import uuid

import pytest

from app.api.v1.universities import _normalized
from app.core.exceptions import AppError
from app.schemas import UserCreate
from app.services.auth import AuthService


def test_university_search_normalization_handles_vietnamese_accents() -> None:
    assert _normalized("ĐẠI HỌC BÁCH KHOA HÀ NỘI") == "dai hoc bach khoa ha noi"


@pytest.mark.asyncio
async def test_registration_rejects_unknown_university(session) -> None:
    with pytest.raises(AppError) as error:
        await AuthService(session).register(
            UserCreate(
                email="unknown-school@example.edu",
                password="abc123",
                full_name="Student",
                university_id=uuid.uuid4(),
            )
        )
    assert error.value.code == "UNIVERSITY_NOT_FOUND"
