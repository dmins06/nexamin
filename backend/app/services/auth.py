import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import AppError
from app.core.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    hash_registration_otp,
    new_refresh_token,
    new_registration_otp,
    verify_password,
    verify_registration_otp,
)
from app.models import RefreshToken, RegistrationChallenge, University, User
from app.schemas import LoginRequest, PasswordChangeRequest, TokenPair, UserCreate
from app.services.email import send_registration_otp


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def register_user(self, payload: UserCreate) -> TokenPair:
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

    async def request_registration(
        self, payload: UserCreate
    ) -> tuple[RegistrationChallenge, str | None]:
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

        now = datetime.now(UTC)
        await self.session.execute(
            update(RegistrationChallenge)
            .where(
                RegistrationChallenge.email == email,
                RegistrationChallenge.consumed_at.is_(None),
            )
            .values(consumed_at=now)
        )
        challenge_id = uuid.uuid4()
        otp = new_registration_otp()
        challenge = RegistrationChallenge(
            id=challenge_id,
            email=email,
            code_hash=hash_registration_otp(challenge_id, otp),
            registration_data={
                "password_hash": hash_password(payload.password),
                "full_name": payload.full_name,
                "university_id": str(payload.university_id) if payload.university_id else None,
                "major": payload.major,
                "student_year": payload.student_year,
            },
            expires_at=now + timedelta(minutes=settings.registration_otp_expire_minutes),
            attempts=0,
        )
        self.session.add(challenge)
        await self.session.commit()
        try:
            await send_registration_otp(email, otp)
        except AppError:
            challenge.consumed_at = datetime.now(UTC)
            await self.session.commit()
            raise
        debug_otp = (
            otp
            if settings.app_env != "production" and settings.email_provider == "console"
            else None
        )
        return challenge, debug_otp

    async def resend_registration(
        self, payload: UserCreate
    ) -> tuple[RegistrationChallenge, str | None]:
        return await self.request_registration(payload)

    async def verify_registration(self, challenge_id: uuid.UUID, otp: str) -> User:
        challenge = await self.session.scalar(
            select(RegistrationChallenge)
            .where(RegistrationChallenge.id == challenge_id)
            .with_for_update()
        )
        now = datetime.now(UTC)
        if challenge is None or challenge.consumed_at is not None:
            raise AppError("OTP_INVALID", "Mã xác thực không hợp lệ hoặc đã được sử dụng", 400)
        expires_at = challenge.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if expires_at <= now:
            challenge.consumed_at = now
            await self.session.commit()
            raise AppError("OTP_EXPIRED", "Mã xác thực đã hết hạn. Hãy đăng ký lại.", 400)
        if challenge.attempts >= 5:
            challenge.consumed_at = now
            await self.session.commit()
            raise AppError("OTP_LOCKED", "Bạn đã nhập sai quá nhiều lần. Hãy đăng ký lại.", 429)
        if not verify_registration_otp(challenge.id, otp, challenge.code_hash):
            challenge.attempts += 1
            if challenge.attempts >= 5:
                challenge.consumed_at = now
            await self.session.commit()
            raise AppError("OTP_INVALID", "Mã xác thực không đúng", 400)
        if await self.session.scalar(select(User.id).where(User.email == challenge.email)):
            challenge.consumed_at = now
            await self.session.commit()
            raise AppError("EMAIL_EXISTS", "Email này đã được sử dụng", 409)

        data = challenge.registration_data
        university_id = data.get("university_id")
        user = User(
            email=challenge.email,
            password_hash=data["password_hash"],
            full_name=data["full_name"],
            university_id=uuid.UUID(university_id) if university_id else None,
            major=data.get("major"),
            student_year=data.get("student_year"),
            is_verified=True,
        )
        challenge.consumed_at = now
        self.session.add(user)
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise AppError("EMAIL_EXISTS", "Email này đã được sử dụng", 409) from exc
        await self.session.refresh(user, attribute_names=["university"])
        return user

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
