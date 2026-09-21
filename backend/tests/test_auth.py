from datetime import UTC, datetime, timedelta

import pytest

from app.core.exceptions import AppError
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
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
async def test_register_login_and_refresh_rotation(session) -> None:
    service = AuthService(session)
    challenge, otp = await service.request_registration(
        UserCreate(email="student@example.edu", password="StrongPass123", full_name="Student")
    )
    assert otp is not None
    user = await service.verify_registration(challenge.id, otp)
    assert user.is_verified
    pair = await service.login(LoginRequest(email=user.email, password="StrongPass123"))
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


def test_expired_access_token_rejected(monkeypatch) -> None:
    import jwt

    from app.config import settings

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
