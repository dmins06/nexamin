import uuid
from urllib.parse import parse_qs, urlsplit

import pytest
from sqlalchemy import select

from app.api.v1.admin import AdminUserSummary, lock_user, unlock_user, users
from app.config import settings
from app.core.exceptions import AppError
from app.core.security import hash_password, verify_password
from app.dependencies import get_admin_user
from app.models import RefreshToken, Role, User
from app.schemas import LoginRequest
from app.services.auth import AuthService
from app.services.password_recovery import reset_password, send_reset_link


@pytest.mark.asyncio
async def test_admin_can_lock_and_unlock_student_but_not_self(session) -> None:
    admin = User(id=uuid.uuid4(), email="admin@example.edu", full_name="Admin",
                 password_hash=hash_password("StrongPass123"), role=Role.ADMIN, is_verified=True)
    student = User(id=uuid.uuid4(), email="student@example.edu", full_name="Student",
                   password_hash=hash_password("StrongPass123"), role=Role.STUDENT)
    session.add_all([admin, student])
    await session.commit()
    pair = await AuthService(session).login(LoginRequest(email=student.email, password="StrongPass123"))
    listed = await users(session, admin, "student")
    assert len(listed) == 1
    assert "password_hash" not in AdminUserSummary.model_fields
    assert listed[0].email == student.email
    await lock_user(student.id, session, admin)
    assert not student.is_active
    token = await session.scalar(select(RefreshToken).where(RefreshToken.user_id == student.id))
    assert token is not None and token.revoked_at is not None
    with pytest.raises(AppError, match="vô hiệu hóa"):
        await AuthService(session).login(LoginRequest(email=student.email, password="StrongPass123"))
    with pytest.raises(AppError):
        await AuthService(session).refresh(pair.refresh_token)
    with pytest.raises(AppError, match="quản trị"):
        await lock_user(admin.id, session, admin)
    await unlock_user(student.id, session, admin)
    assert student.is_active


@pytest.mark.asyncio
async def test_student_cannot_be_admin(session) -> None:
    student = User(id=uuid.uuid4(), email="student@example.edu", full_name="Student",
                   role=Role.STUDENT)
    with pytest.raises(AppError) as error:
        await get_admin_user(student)
    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_email_reset_token_is_not_returned_and_is_single_use(session, monkeypatch) -> None:
    import app.services.password_recovery as recovery

    student = User(id=uuid.uuid4(), email="student@example.edu", full_name="Student",
                   password_hash=hash_password("StrongPass123"), is_active=True)
    session.add(student)
    await session.commit()
    monkeypatch.setattr(settings, "resend_api_key", "test-only")
    monkeypatch.setattr(settings, "mail_from_email", "noreply@example.edu")
    monkeypatch.setattr(settings, "public_site_url", "https://nexamin.id.vn")
    sent: list[str] = []
    async def fake_send(recipient: str, link: str) -> None:
        sent.append(link)

    monkeypatch.setattr(recovery, "_send_message", fake_send)
    assert await send_reset_link(student) is None
    token = parse_qs(urlsplit(sent[0]).query)["reset_token"][0]
    await reset_password(session, token, "NewStrongPass456")
    assert verify_password("NewStrongPass456", student.password_hash or "")
    with pytest.raises(AppError) as error:
        await reset_password(session, token, "AnotherStrongPass789")
    assert error.value.code == "INVALID_RESET_TOKEN"
