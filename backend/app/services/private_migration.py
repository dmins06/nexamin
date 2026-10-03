"""Copy/verify/retire an exact private-file key. No database or URL rewriting."""

import hashlib
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from app.services.private_files import ATTACHMENT_TYPES, UUID_PATTERN


def private_file_key(key: str) -> bool:
    """Includes orphan uploads; excludes avatars, social images and traversal."""
    return re.fullmatch(
        rf"(?:messages/{UUID_PATTERN}|users/{UUID_PATTERN}/courses/{UUID_PATTERN})/"
        rf"{UUID_PATTERN}\.(?:png|jpe?g|webp|gif|pdf|txt|zip|docx?|pptx)", key,
    ) is not None


@dataclass(frozen=True)
class CopyResult:
    size: int
    copied: bool
    retired: bool


async def copy_private_file(
    key: str, source_read: Callable[[str], Awaitable[bytes]],
    target_read: Callable[[str], Awaitable[bytes]],
    target_write: Callable[[str, bytes, str], Awaitable[None]],
    *, retire_source: Callable[[str], Awaitable[None]] | None = None,
    maximum_bytes: int = 32 * 1024 * 1024,
) -> CopyResult:
    if not private_file_key(key):
        raise ValueError("Not a private file key; refusing to touch public assets")
    source = await source_read(key)
    if not source or len(source) > maximum_bytes:
        raise ValueError("Source is empty or exceeds the migration size bound")
    expected = hashlib.sha256(source).digest()
    try:
        existing = await target_read(key)
    except FileNotFoundError:
        existing = None
    copied = existing is None
    if existing is not None and hashlib.sha256(existing).digest() != expected:
        raise ValueError("Private target differs; refusing to overwrite or retire source")
    if copied:
        extension = key[key.rfind('.'):]
        mime_type = ATTACHMENT_TYPES.get(extension, "application/vnd.openxmlformats-officedocument.presentationml.presentation")
        await target_write(key, source, mime_type)
    verified = await target_read(key)
    if len(verified) != len(source) or hashlib.sha256(verified).digest() != expected:
        raise ValueError("Private copy failed byte verification; source retained")
    if retire_source is not None:
        await retire_source(key)
    return CopyResult(size=len(source), copied=copied, retired=retire_source is not None)
