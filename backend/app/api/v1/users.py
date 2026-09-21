import uuid

from fastapi import APIRouter, File, UploadFile

from app.config import settings
from app.core.exceptions import AppError
from app.core.storage import local_storage, storage
from app.dependencies import CurrentUser, DBSession
from app.schemas import MessageResponse, PasswordChangeRequest, ProfileUpdate, UserResponse
from app.schemas.profile import ProfileResponse
from app.services.auth import AuthService
from app.services.profile import ProfileService

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=ProfileResponse)
async def get_profile(session: DBSession, user: CurrentUser) -> ProfileResponse:
    return await ProfileService(session, user).get()


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    payload: ProfileUpdate, session: DBSession, user: CurrentUser
) -> UserResponse:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await session.commit()
    await session.refresh(user)
    await session.refresh(user, attribute_names=["university"])
    return UserResponse.model_validate(user)


@router.post("/me/change-password", response_model=MessageResponse)
async def change_password(
    payload: PasswordChangeRequest, session: DBSession, user: CurrentUser
) -> MessageResponse:
    await AuthService(session).change_password(user, payload)
    return MessageResponse(message="Mật khẩu đã được thay đổi. Hãy đăng nhập lại.")


@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    session: DBSession, user: CurrentUser, avatar: UploadFile = File()
) -> UserResponse:
    content = await avatar.read(5 * 1024 * 1024 + 1)
    signatures = {b"\x89PNG\r\n\x1a\n": ".png", b"\xff\xd8\xff": ".jpg", b"RIFF": ".webp"}
    extension = next(
        (ext for signature, ext in signatures.items() if content.startswith(signature)), None
    )
    if not extension or len(content) > 5 * 1024 * 1024:
        raise AppError("INVALID_AVATAR", "Avatar must be a PNG, JPEG, or WebP under 5 MB", 415)
    key = f"users/{user.id}/avatar/{uuid.uuid4()}{extension}"
    content_type = {".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp"}[extension]
    if settings.storage_provider == "local":
        await local_storage.upload(key, content, content_type)
        user.avatar_url = f"{settings.media_base_url.rstrip('/')}/{key}"
    else:
        await storage.upload(key, content, content_type)
        user.avatar_url = f"{settings.s3_endpoint}/{settings.s3_bucket}/{key}"
    await session.commit()
    await session.refresh(user)
    await session.refresh(user, attribute_names=["university"])
    return UserResponse.model_validate(user)
