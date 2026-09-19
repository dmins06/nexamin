import pytest
from pydantic import ValidationError

from app.schemas import UserCreate


def test_six_character_password_is_accepted() -> None:
    payload = UserCreate(email="student@example.edu", password="abc123", full_name="Student")
    assert payload.password == "abc123"


def test_password_shorter_than_six_characters_is_rejected() -> None:
    with pytest.raises(ValidationError):
        UserCreate(email="student@example.edu", password="12345", full_name="Student")
