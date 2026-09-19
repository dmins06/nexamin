import uuid
from typing import Annotated

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import AppError
from app.core.security import decode_access_token
from app.database import get_db
from app.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_v1_prefix}/auth/login")
DBSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    session: DBSession, token: Annotated[str, Depends(oauth2_scheme)]
) -> User:
    payload = decode_access_token(token)
    try:
        user_id = uuid.UUID(payload["sub"])
    except (ValueError, TypeError) as exc:
        raise AppError("INVALID_TOKEN", "Invalid access token", 401) from exc
    user = await session.scalar(select(User).where(User.id == user_id, User.is_active.is_(True)))
    if user is None:
        raise AppError("INVALID_TOKEN", "User is inactive or missing", 401)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
