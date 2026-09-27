"""Email-only password recovery. The admin never receives the reset token."""

import hashlib
import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import quote

import httpx
import jwt
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import AppError
from app.core.security import hash_password
from app.models import RefreshToken, User


def mail_enabled() -> bool:
    return bool(settings.resend_api_key and settings.mail_from_email
                and settings.public_site_url.startswith("https://"))


def _fingerprint(user: User) -> str:
    return hashlib.sha256((user.password_hash or "").encode()).hexdigest()


async def _send_message(recipient: str, link: str) -> None:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.mail_from_email,
                "to": [recipient],
                "subject": "Nexamin - Đặt lại mật khẩu",
                "text": "Bạn đã yêu cầu đặt lại mật khẩu Nexamin. "
                        f"Mở liên kết này trong 30 phút: {link}\n"
                        "Nếu không yêu cầu, hãy bỏ qua email này.",
            },
        )
    if response.status_code not in {200, 201, 202}:
        raise AppError("MAIL_SEND_FAILED", "Không gửi được email. Hãy kiểm tra cấu hình dịch vụ thư.", 503)


async def send_reset_link(user: User) -> None:
    if not mail_enabled():
        raise AppError("MAIL_NOT_CONFIGURED", "Chưa cấu hình email hỗ trợ đặt lại mật khẩu.", 503)
    if not user.is_active:
        raise AppError("ACCOUNT_DISABLED", "Mở khóa tài khoản trước khi gửi email.", 409)
    if not user.password_hash:
        raise AppError("PASSWORD_NOT_SET", "Tài khoản này đăng nhập qua Google.", 409)
    token = jwt.encode(
        {"sub": str(user.id), "purpose": "password_reset", "fingerprint": _fingerprint(user),
         "exp": datetime.now(UTC) + timedelta(minutes=30)},
        settings.jwt_secret, algorithm=settings.jwt_algorithm,
    )
    link = f"{settings.public_site_url.rstrip('/')}/?reset_token={quote(token)}"
    try:
        await _send_message(user.email, link)
    except httpx.HTTPError as exc:
        raise AppError("MAIL_SEND_FAILED", "Không gửi được email. Hãy thử lại sau.", 503) from exc


async def reset_password(session: AsyncSession, token: str, new_password: str) -> None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("purpose") != "password_reset":
            raise ValueError("Invalid token purpose")
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError, TypeError) as exc:
        raise AppError("INVALID_RESET_TOKEN", "Liên kết đặt lại không hợp lệ hoặc đã hết hạn.", 400) from exc
    user = await session.scalar(select(User).where(User.id == user_id).with_for_update())
    if user is None or not user.is_active or payload.get("fingerprint") != _fingerprint(user):
        raise AppError("INVALID_RESET_TOKEN", "Liên kết đặt lại không hợp lệ hoặc đã dùng.", 400)
    user.password_hash = hash_password(new_password)
    await session.execute(
        update(RefreshToken).where(RefreshToken.user_id == user.id,
                                   RefreshToken.revoked_at.is_(None)).values(revoked_at=datetime.now(UTC))
    )
    await session.commit()
