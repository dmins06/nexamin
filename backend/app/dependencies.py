import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import AppError
from app.core.security import decode_access_token
from app.database import get_db
from app.models import RefreshToken, Role, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_v1_prefix}/auth/login")
DBSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    session: DBSession, token: Annotated[str, Depends(oauth2_scheme)]
) -> User:
    payload = decode_access_token(token)
    try:
        if not isinstance(payload.get("sub"), str) or not isinstance(payload.get("sid"), str):
            raise ValueError("Missing or invalid session binding")
        user_id = uuid.UUID(payload["sub"])
        family_id = uuid.UUID(payload["sid"])
    except (KeyError, ValueError, TypeError) as exc:
        raise AppError("INVALID_TOKEN", "Invalid access token", 401) from exc
    # EXISTS keeps authentication to one query, including server-side revocation.
    # Rotation keeps the family alive; logout/recovery/replay revokes the family.
    live_session = select(RefreshToken.id).where(
        RefreshToken.user_id == user_id,
        RefreshToken.family_id == family_id,
        RefreshToken.revoked_at.is_(None),
        RefreshToken.expires_at > datetime.now(UTC),
    ).exists()
    user = await session.scalar(select(User).where(
        User.id == user_id, User.is_active.is_(True), live_session,
    ))
    if user is None:
        raise AppError("INVALID_TOKEN", "User is inactive or missing", 401)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_admin_user(user: CurrentUser) -> User:
    if user.role != Role.ADMIN:
        raise AppError("ADMIN_REQUIRED", "Chỉ quản trị viên được thực hiện thao tác này.", 403)
    return user


AdminUser = Annotated[User, Depends(get_admin_user)]
