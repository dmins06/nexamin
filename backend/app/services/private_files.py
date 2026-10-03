"""Authorization-bound file delivery; never fetch a URL from message content."""

import json
import re
import uuid
from pathlib import PurePosixPath
from urllib.parse import quote, urlsplit

from fastapi import Response
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import AppError
from app.core.storage import selected_storage
from app.models import DirectMessage

ATTACHMENT_TYPES = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf",
    ".txt": "text/plain", ".zip": "application/zip", ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
UUID_PATTERN = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"


def ensure_private_writes_enabled() -> None:
    if settings.private_file_writes_paused:
        raise AppError(
            "PRIVATE_FILES_MAINTENANCE", "Đang bảo trì lưu trữ riêng tư. Vui lòng thử tải/xóa file sau.", 503,
        )


def attachment_key(url: str, sender_id: uuid.UUID) -> str:
    parts = urlsplit(url)
    if parts.query or parts.fragment or parts.username or parts.password:
        raise ValueError("Invalid attachment URL")
    bases = [settings.media_base_url.rstrip("/"), *settings.legacy_media_base_urls]
    if settings.storage_provider == "s3":
        bases.append(f"{settings.s3_endpoint.rstrip('/')}/{settings.s3_bucket}")
    key = None
    for base_url in bases:
        base = urlsplit(base_url)
        if parts.scheme == base.scheme and parts.netloc == base.netloc:
            prefix = base.path.rstrip("/") + "/"
            if parts.path.startswith(prefix):
                key = parts.path[len(prefix):]
                break
    if key is None or re.fullmatch(
        rf"messages/{sender_id}/{UUID_PATTERN}\.(?:png|jpe?g|webp|gif|pdf|txt|zip|docx?)", key,
    ) is None:
        raise ValueError("Attachment is not owned by the sender")
    return key


def attachment_payload(content: str) -> dict[str, object] | None:
    try:
        parsed = json.loads(content)
    except (ValueError, TypeError):
        return None
    if not isinstance(parsed, dict) or "attachment" not in parsed:
        return None
    payload = parsed["attachment"]
    if not isinstance(payload, dict) or not isinstance(payload.get("url"), str):
        raise ValueError("Invalid attachment payload")
    return payload


def validate_message_attachment(content: str, sender_id: uuid.UUID) -> None:
    try:
        payload = attachment_payload(content)
        if payload is not None:
            attachment_key(str(payload["url"]), sender_id)
    except ValueError as exc:
        raise AppError("INVALID_ATTACHMENT", "File đính kèm không thuộc người gửi.", 422) from exc


def file_response(content: bytes, filename: str, mime_type: str) -> Response:
    # Downloads, even images, are never served as attacker-controlled HTML.
    safe_name = PurePosixPath(filename.replace("\\", "/")).name[:250] or "attachment"
    return Response(content, media_type=mime_type, headers={
        "Content-Disposition": f"attachment; filename*=UTF-8''{quote(safe_name, safe='')}",
        "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    })


async def message_file(session: AsyncSession, user_id: uuid.UUID, message_id: uuid.UUID) -> Response:
    message = await session.scalar(select(DirectMessage).where(
        DirectMessage.id == message_id,
        or_(DirectMessage.sender_id == user_id, DirectMessage.recipient_id == user_id),
    ))
    if message is None:
        raise AppError("FILE_NOT_FOUND", "Không tìm thấy file hoặc bạn không có quyền xem.", 404)
    try:
        payload = attachment_payload(message.content)
        if payload is None:
            raise ValueError("No attachment")
        key = attachment_key(str(payload["url"]), message.sender_id)
        content = await selected_storage().download(key)
    except (ValueError, FileNotFoundError) as exc:
        raise AppError("FILE_NOT_FOUND", "Không tìm thấy file hoặc bạn không có quyền xem.", 404) from exc
    name = payload.get("name")
    return file_response(
        content, name if isinstance(name, str) else PurePosixPath(key).name,
        ATTACHMENT_TYPES[PurePosixPath(key).suffix],
    )
