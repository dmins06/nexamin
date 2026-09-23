from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.config import settings
from app.core.exceptions import AppError
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.models import User
from app.schemas import LoginRequest, PasswordChangeRequest, UserCreate
from app.services.auth import AuthService


def test_password_hash_and_access_token() -> None:
    hashed = hash_password("StrongPass123")
    assert hashed != "StrongPass123"
    assert verify_password("StrongPass123", hashed)
    token, expires_in = create_access_token(__import__("uuid").uuid4(), "student")
    assert decode_access_token(token)["type"] == "access"
    assert expires_in > 0


@pytest.mark.asyncio
async def test_register_login_refresh_and_password_change(session) -> None:
    service = AuthService(session)
    pair = await service.register(
        UserCreate(email="student@example.edu", password="StrongPass123", full_name="Student")
    )
    assert pair.access_token
    user = await session.scalar(select(User).where(User.email == "student@example.edu"))
    assert user is not None
    assert user.is_verified

    rotated = await service.refresh(pair.refresh_token)
    assert rotated.refresh_token != pair.refresh_token
    with pytest.raises(AppError) as reused:
        await service.refresh(pair.refresh_token)
    assert reused.value.code == "INVALID_REFRESH_TOKEN"

    await service.change_password(
        user, PasswordChangeRequest(current_password="StrongPass123", new_password="NewPass456")
    )
    with pytest.raises(AppError) as old_password:
        await service.login(LoginRequest(email=user.email, password="StrongPass123"))
    assert old_password.value.code == "INVALID_CREDENTIALS"
    await service.login(LoginRequest(email=user.email, password="NewPass456"))


@pytest.mark.asyncio
async def test_duplicate_registration_is_rejected(session) -> None:
    service = AuthService(session)
    payload = UserCreate(email="same@example.edu", password="StrongPass123", full_name="Student")
    await service.register(payload)
    with pytest.raises(AppError) as duplicate:
        await service.register(payload)
    assert duplicate.value.code == "EMAIL_EXISTS"


def test_expired_access_token_rejected() -> None:
    import jwt

    token = jwt.encode(
        {
            "sub": "00000000-0000-0000-0000-000000000001",
            "type": "access",
            "exp": datetime.now(UTC) - timedelta(seconds=1),
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    with pytest.raises(AppError) as error:
        decode_access_token(token)
    assert error.value.code == "TOKEN_EXPIRED"
