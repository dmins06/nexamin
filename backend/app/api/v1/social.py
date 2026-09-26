import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import (
    APIRouter,
    File,
    Query,
    Response,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy import select

from app.config import settings
from app.core.exceptions import AppError
from app.core.security import decode_access_token
from app.core.storage import blob_storage, local_storage, storage
from app.database import SessionFactory
from app.dependencies import CurrentUser, DBSession
from app.models import User
from app.realtime import realtime_hub
from app.schemas.social import (
    DirectMessageResponse,
    FriendshipResponse,
    MessageAttachmentResponse,
    MessageCreate,
    PublicProfile,
    SocialCommentCreate,
    SocialPostCreate,
    SocialPostResponse,
    UnreadMessageSummary,
)
from app.services.feed import FeedService
from app.services.social import SocialService

router = APIRouter(prefix="/social", tags=["Social"])


@router.get("/people", response_model=list[PublicProfile])
async def find_people(
    session: DBSession,
    user: CurrentUser,
    q: str = Query(default="", max_length=120),
) -> list[PublicProfile]:
    return await SocialService(session, user).people(q)


@router.get("/profiles/{user_id}", response_model=PublicProfile)
async def public_profile(
    user_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> PublicProfile:
    return await SocialService(session, user).profile(user_id)


@router.get("/feed", response_model=list[SocialPostResponse])
async def social_feed(
    session: DBSession,
    user: CurrentUser,
    profile_id: uuid.UUID | None = Query(default=None),
) -> list[SocialPostResponse]:
    return await FeedService(session, user).feed(profile_id=profile_id)


@router.post(
    "/posts",
    response_model=SocialPostResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_social_post(
    payload: SocialPostCreate,
    session: DBSession,
    user: CurrentUser,
) -> SocialPostResponse:
    return await FeedService(session, user).create(payload)


@router.post("/posts/upload", response_model=MessageAttachmentResponse)
async def upload_post_image(
    session: DBSession,
    user: CurrentUser,
    image: UploadFile = File(),
) -> MessageAttachmentResponse:
    del session
    content = await image.read(8 * 1024 * 1024 + 1)
    signatures = {
        b"\x89PNG\r\n\x1a\n": (".png", "image/png"),
        b"\xff\xd8\xff": (".jpg", "image/jpeg"),
        b"RIFF": (".webp", "image/webp"),
        b"GIF8": (".gif", "image/gif"),
    }
    detected = next(
        (value for signature, value in signatures.items() if content.startswith(signature)),
        None,
    )
    if detected is None or len(content) > 8 * 1024 * 1024:
        raise AppError(
            "INVALID_POST_IMAGE",
            "Ảnh phải là PNG, JPEG, WebP hoặc GIF và không vượt quá 8 MB",
            415,
        )
    extension, content_type = detected
    if extension == ".webp" and content[8:12] != b"WEBP":
        raise AppError("INVALID_POST_IMAGE", "Tệp WebP không hợp lệ", 415)
    key = f"social/{user.id}/{uuid.uuid4()}{extension}"
    if settings.storage_provider == "local":
        await local_storage.upload(key, content, content_type)
        url = f"{settings.media_base_url.rstrip('/')}/{key}"
    elif settings.storage_provider == "blob":
        await blob_storage.upload(key, content, content_type)
        url = f"{settings.media_base_url.rstrip('/')}/{key}"
    else:
        await storage.upload(key, content, content_type)
        url = f"{settings.s3_endpoint.rstrip('/')}/{settings.s3_bucket}/{key}"
    return MessageAttachmentResponse(
        url=url,
        name=Path(image.filename or f"image{extension}").name,
        mime_type=content_type,
    )


@router.post("/posts/{post_id}/like", response_model=SocialPostResponse)
async def toggle_post_like(
    post_id: uuid.UUID,
    session: DBSession,
    user: CurrentUser,
) -> SocialPostResponse:
    return await FeedService(session, user).toggle_like(post_id)


@router.post("/posts/{post_id}/comments", response_model=SocialPostResponse)
async def comment_on_post(
    post_id: uuid.UUID,
    payload: SocialCommentCreate,
    session: DBSession,
    user: CurrentUser,
) -> SocialPostResponse:
    return await FeedService(session, user).comment(post_id, payload.content)


@router.post(
    "/posts/{post_id}/repost",
    response_model=SocialPostResponse,
    status_code=status.HTTP_201_CREATED,
)
async def repost_social_post(
    post_id: uuid.UUID,
    payload: SocialPostCreate,
    session: DBSession,
    user: CurrentUser,
) -> SocialPostResponse:
    return await FeedService(session, user).repost(post_id, payload)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_social_post(
    post_id: uuid.UUID,
    session: DBSession,
    user: CurrentUser,
) -> Response:
    await FeedService(session, user).delete(post_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/friendships", response_model=list[FriendshipResponse])
async def friendships(session: DBSession, user: CurrentUser) -> list[FriendshipResponse]:
    return await SocialService(session, user).list_friendships()


@router.post(
    "/friendships/{user_id}",
    response_model=FriendshipResponse,
    status_code=status.HTTP_201_CREATED,
)
async def request_friend(
    user_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> FriendshipResponse:
    return await SocialService(session, user).request_friend(user_id)


@router.post("/friendships/{friendship_id}/accept", response_model=FriendshipResponse)
async def accept_friend(
    friendship_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> FriendshipResponse:
    return await SocialService(session, user).accept(friendship_id)


@router.delete("/friendships/{friendship_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_friend(
    friendship_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> Response:
    await SocialService(session, user).remove(friendship_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/messages/unread", response_model=UnreadMessageSummary)
async def unread_messages(session: DBSession, user: CurrentUser) -> UnreadMessageSummary:
    return await SocialService(session, user).unread_messages()


@router.post("/messages/upload", response_model=MessageAttachmentResponse)
async def upload_message_attachment(
    session: DBSession,
    user: CurrentUser,
    file: UploadFile = File(),
) -> MessageAttachmentResponse:
    del session
    filename = Path(file.filename or "attachment").name
    extension = Path(filename).suffix.lower()
    allowed_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".pdf": "application/pdf",
        ".txt": "text/plain",
        ".zip": "application/zip",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    mime_type = allowed_types.get(extension)
    if mime_type is None:
        raise AppError(
            "UNSUPPORTED_ATTACHMENT",
            "Chỉ hỗ trợ ảnh, PDF, Word, văn bản và tệp ZIP",
            415,
        )
    if file.content_type not in (None, "application/octet-stream", mime_type):
        raise AppError("INVALID_ATTACHMENT", "Định dạng tệp không hợp lệ", 415)

    content = await file.read(10 * 1024 * 1024 + 1)
    if len(content) > 10 * 1024 * 1024:
        raise AppError("ATTACHMENT_TOO_LARGE", "Tệp đính kèm không được vượt quá 10 MB", 413)
    if not content:
        raise AppError("EMPTY_ATTACHMENT", "Tệp đính kèm đang trống")

    key = f"messages/{user.id}/{uuid.uuid4()}{extension}"
    if settings.storage_provider == "local":
        await local_storage.upload(key, content, mime_type)
        url = f"{settings.media_base_url.rstrip('/')}/{key}"
    elif settings.storage_provider == "blob":
        await blob_storage.upload(key, content, mime_type)
        url = f"{settings.media_base_url.rstrip('/')}/{key}"
    else:
        await storage.upload(key, content, mime_type)
        url = f"{settings.s3_endpoint.rstrip('/')}/{settings.s3_bucket}/{key}"
    return MessageAttachmentResponse(url=url, name=filename, mime_type=mime_type)


@router.get("/messages/{user_id}", response_model=list[DirectMessageResponse])
async def messages(
    user_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> list[DirectMessageResponse]:
    return await SocialService(session, user).messages(user_id)


@router.post(
    "/messages/{user_id}",
    response_model=DirectMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    user_id: uuid.UUID,
    payload: MessageCreate,
    session: DBSession,
    user: CurrentUser,
) -> DirectMessageResponse:
    message = await SocialService(session, user).send_message(user_id, payload.content)
    await realtime_hub.publish(
        user_id,
        {"type": "message.new", "message": message.model_dump(mode="json")},
    )
    return message


@router.websocket("/ws")
async def realtime_events(websocket: WebSocket, token: str = Query(min_length=20)) -> None:
    try:
        payload = decode_access_token(token)
        user_id = uuid.UUID(payload["sub"])
        async with SessionFactory() as session:
            user = await session.scalar(
                select(User).where(User.id == user_id, User.is_active.is_(True))
            )
            if user is not None:
                user.last_seen_at = datetime.now(UTC)
                await session.commit()
        if user is None:
            await websocket.close(code=4401)
            return
    except (AppError, TypeError, ValueError, KeyError):
        await websocket.close(code=4401)
        return

    await realtime_hub.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        still_online = await realtime_hub.disconnect(user_id, websocket)
        if not still_online:
            async with SessionFactory() as session:
                disconnected_user = await session.get(User, user_id)
                if disconnected_user is not None:
                    disconnected_user.last_seen_at = datetime.now(UTC)
                    await session.commit()
