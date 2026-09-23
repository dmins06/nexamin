import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import AppError
from app.core.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)
from app.models import RefreshToken, University, User
from app.schemas import LoginRequest, PasswordChangeRequest, TokenPair, UserCreate


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def register(self, payload: UserCreate) -> TokenPair:
        email = payload.email.lower()
        if await self.session.scalar(select(User.id).where(User.email == email)):
            raise AppError("EMAIL_EXISTS", "Email này đã được sử dụng", 409)
        if (
            payload.university_id is not None
            and await self.session.get(University, payload.university_id) is None
        ):
            raise AppError(
                "UNIVERSITY_NOT_FOUND",
                "Không tìm thấy trường đại học đã chọn. Hãy tải lại danh sách trường.",
                422,
            )

        user = User(
            email=email,
            password_hash=hash_password(payload.password),
            full_name=payload.full_name,
            university_id=payload.university_id,
            major=payload.major,
            student_year=payload.student_year,
            is_verified=True,
        )
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user, attribute_names=["university"])
        return await self._issue_pair(user)

    async def login(self, payload: LoginRequest) -> TokenPair:
        user = await self.session.scalar(select(User).where(User.email == payload.email.lower()))
        if (
            user is None
            or user.password_hash is None
            or not verify_password(payload.password, user.password_hash)
        ):
            raise AppError("INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng", 401)
        if not user.is_active:
            raise AppError("ACCOUNT_DISABLED", "Tài khoản đã bị vô hiệu hóa", 403)
        return await self._issue_pair(user)

    async def change_password(self, user: User, payload: PasswordChangeRequest) -> None:
        if user.password_hash is None or not verify_password(
            payload.current_password, user.password_hash
        ):
            raise AppError("INVALID_PASSWORD", "Mật khẩu hiện tại không đúng", 400)
        user.password_hash = hash_password(payload.new_password)
        await self.session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=datetime.now(UTC))
        )
        await self.session.commit()

    async def refresh(self, raw_token: str) -> TokenPair:
        now = datetime.now(UTC)
        token_hash = hash_refresh_token(raw_token)
        stored = await self.session.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash).with_for_update()
        )
        expires_at = stored.expires_at if stored is not None else now
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if stored is None or stored.revoked_at is not None or expires_at <= now:
            if stored is not None and stored.revoked_at is not None:
                await self.session.execute(
                    update(RefreshToken)
                    .where(RefreshToken.family_id == stored.family_id)
                    .values(revoked_at=now)
                )
                await self.session.commit()
            raise AppError("INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired", 401)
        user = await self.session.get(User, stored.user_id)
        if user is None or not user.is_active:
            raise AppError("INVALID_REFRESH_TOKEN", "Refresh token is invalid", 401)
        raw_next, next_hash = new_refresh_token()
        stored.revoked_at = now
        stored.replaced_by_hash = next_hash
        self.session.add(
            RefreshToken(
                user_id=user.id,
                token_hash=next_hash,
                family_id=stored.family_id,
                expires_at=now + timedelta(days=settings.refresh_token_expire_days),
            )
        )
        access, expires_in = create_access_token(user.id, user.role.value)
        await self.session.commit()
        return TokenPair(access_token=access, refresh_token=raw_next, expires_in=expires_in)

    async def logout(self, raw_token: str) -> None:
        stored = await self.session.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw_token))
        )
        if stored is not None and stored.revoked_at is None:
            stored.revoked_at = datetime.now(UTC)
            await self.session.commit()

    async def _issue_pair(self, user: User) -> TokenPair:
        raw_refresh, token_hash = new_refresh_token()
        self.session.add(
            RefreshToken(
                user_id=user.id,
                token_hash=token_hash,
                family_id=uuid.uuid4(),
                expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
            )
        )
        access, expires_in = create_access_token(user.id, user.role.value)
        await self.session.commit()
        return TokenPair(access_token=access, refresh_token=raw_refresh, expires_in=expires_in)
