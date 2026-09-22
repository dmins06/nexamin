from datetime import UTC, datetime, timedelta

import pytest

from app.config import settings
from app.core.exceptions import AppError
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.schemas import LoginRequest, PasswordChangeRequest, UserCreate
from app.services.auth import AuthService
from app.services.email import send_registration_otp


def test_password_hash_and_access_token() -> None:
    hashed = hash_password("StrongPass123")
    assert hashed != "StrongPass123"
    assert verify_password("StrongPass123", hashed)
    token, expires_in = create_access_token(__import__("uuid").uuid4(), "student")
    assert decode_access_token(token)["type"] == "access"
    assert expires_in > 0


@pytest.mark.asyncio
async def test_register_creates_user_without_otp(session) -> None:
    service = AuthService(session)
    pair = await service.register_user(
        UserCreate(email="direct@example.edu", password="StrongPass123", full_name="Direct User")
    )
    assert pair.access_token
    assert pair.refresh_token

    loaded = await service.login(LoginRequest(email="direct@example.edu", password="StrongPass123"))
    assert loaded.access_token
    assert loaded.refresh_token


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


@pytest.mark.asyncio
async def test_register_resend_creates_new_challenge(session) -> None:
    service = AuthService(session)
    first, first_otp = await service.request_registration(
        UserCreate(email="resend@example.edu", password="StrongPass123", full_name="Resend User")
    )
    second, second_otp = await service.resend_registration(
        UserCreate(email="resend@example.edu", password="StrongPass123", full_name="Resend User")
    )

    assert first.id != second.id
    assert first_otp is not None
    assert second_otp is not None
    await session.refresh(first)
    assert first.consumed_at is not None
    with pytest.raises(AppError, match="Mã xác thực không hợp lệ hoặc đã được sử dụng"):
        await service.verify_registration(first.id, first_otp)


@pytest.mark.asyncio
async def test_send_registration_otp_via_resend(monkeypatch) -> None:
    settings.email_provider = "resend"
    settings.resend_api_key = "test_key"
    settings.resend_from_email = "StudyHubAI <noreply@studyhub.ai>"

    class FakeResponse:
        status_code = 200

    def fake_post(
        url: str,
        *,
        headers: dict[str, str],
        json: dict[str, object],
        timeout: int | None = None,
    ) -> FakeResponse:
        assert url == "https://api.resend.com/emails"
        assert headers["Authorization"] == "Bearer test_key"
        assert json["from"] == "noreply@studyhub.ai"
        assert json["to"] == ["user@example.edu"]
        assert json["subject"] == "Mã xác thực StudyHubAI"
        assert timeout == 20
        return FakeResponse()

    monkeypatch.setattr("app.services.email.httpx.post", fake_post)

    await send_registration_otp("user@example.edu", "123456")


def test_expired_access_token_rejected(monkeypatch) -> None:
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
