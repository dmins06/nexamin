"""Async parser transport with admission, wall timeout and bounded output."""
import asyncio
import json
import os
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from app.config import settings
from app.core.exceptions import AppError
from app.workers.document_parser import ParserLimits

_active = 0
PARSER_SCRIPT = Path(__file__).resolve().parents[1] / "workers/document_parser.py"


def parser_limits() -> ParserLimits:
    return ParserLimits(
        max_input_bytes=settings.max_upload_bytes,
        max_archive_bytes=settings.document_archive_max_bytes,
        max_member_bytes=settings.document_archive_max_member_bytes,
        max_archive_entries=settings.document_archive_max_entries,
        max_compression_ratio=settings.document_archive_max_ratio,
        max_pages=settings.document_max_pages,
        max_text_bytes=settings.document_max_text_bytes,
        memory_mib=settings.document_parser_memory_mib,
        cpu_seconds=settings.document_parser_cpu_seconds,
    )


def rejection(code: str) -> AppError:
    errors = {
        "DOCUMENT_RESOURCE_LIMIT": (413, "Tài liệu vượt giới hạn xử lý. Hãy giảm dung lượng hoặc chia nhỏ file."),
        "INVALID_DOCUMENT": (422, "Tài liệu không hợp lệ, bị mã hóa hoặc không thể đọc được."),
        "DOCUMENT_PROCESSOR_UNAVAILABLE": (503, "Bộ xử lý tài liệu chưa sẵn sàng. Vui lòng thử lại."),
        "DOCUMENT_PROCESSING_BUSY": (503, "Đang xử lý tài liệu khác. Vui lòng thử tải lại sau."),
    }
    status, message = errors.get(code, errors["DOCUMENT_PROCESSOR_UNAVAILABLE"])
    return AppError(code if code in errors else "DOCUMENT_PROCESSOR_UNAVAILABLE", message, status)


@asynccontextmanager
async def processing_slot() -> AsyncIterator[None]:
    global _active
    # No await between checking and reserving: atomic on the API event loop.
    # Fail immediately rather than queuing file bytes in API memory.
    if _active >= settings.document_parser_concurrency:
        raise rejection("DOCUMENT_PROCESSING_BUSY")
    _active += 1
    try:
        yield
    finally:
        _active -= 1


async def _exchange(process: asyncio.subprocess.Process, content: bytes, maximum: int) -> bytes:
    if process.stdin is None or process.stdout is None:
        raise rejection("DOCUMENT_PROCESSOR_UNAVAILABLE")
    try:
        process.stdin.write(content)
        await process.stdin.drain()
    except (BrokenPipeError, ConnectionResetError):
        pass
    finally:
        process.stdin.close()
    output = bytearray()
    while block := await process.stdout.read(64 * 1024):
        output.extend(block)
        if len(output) > maximum:
            raise rejection("DOCUMENT_RESOURCE_LIMIT")
    await process.wait()
    return bytes(output)


def decode_pages(raw: bytes, bounds: ParserLimits) -> list[tuple[int | None, str]]:
    try:
        payload: object = json.loads(raw)
    except (ValueError, UnicodeDecodeError) as error:
        raise rejection("DOCUMENT_PROCESSOR_UNAVAILABLE") from error
    if not isinstance(payload, dict):
        raise rejection("DOCUMENT_PROCESSOR_UNAVAILABLE")
    if "error" in payload:
        code = payload["error"]
        raise rejection(code if isinstance(code, str) else "DOCUMENT_PROCESSOR_UNAVAILABLE")
    data: object = payload.get("pages")
    if not isinstance(data, list) or len(data) > bounds.max_pages:
        raise rejection("DOCUMENT_PROCESSOR_UNAVAILABLE")
    pages: list[tuple[int | None, str]] = []
    size = 0
    for item in data:
        if not isinstance(item, list) or len(item) != 2:
            raise rejection("DOCUMENT_PROCESSOR_UNAVAILABLE")
        number, text = item
        if ((number is not None and (type(number) is not int or not 1 <= number <= bounds.max_pages))
                or not isinstance(text, str)):
            raise rejection("DOCUMENT_PROCESSOR_UNAVAILABLE")
        try:
            size += len(text.encode("utf-8"))
        except UnicodeError as error:
            raise rejection("DOCUMENT_PROCESSOR_UNAVAILABLE") from error
        if size > bounds.max_text_bytes:
            raise rejection("DOCUMENT_RESOURCE_LIMIT")
        pages.append((number, text))
    return pages


async def extract_in_child(content: bytes, extension: str) -> list[tuple[int | None, str]]:
    """Caller must hold processing_slot, including while reading upload bytes."""
    bounds = parser_limits()
    if len(content) > bounds.max_input_bytes:
        raise rejection("DOCUMENT_RESOURCE_LIMIT")
    # The child never receives JWT/DB/Blob/Gemini tokens or PYTHONPATH.
    environment = {name: os.environ[name] for name in ("SYSTEMROOT", "WINDIR") if name in os.environ}
    try:
        process = await asyncio.create_subprocess_exec(
            sys.executable, "-I", "-B", str(PARSER_SCRIPT), extension, *bounds.arguments(),
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL, env=environment,
        )
    except OSError as error:
        raise rejection("DOCUMENT_PROCESSOR_UNAVAILABLE") from error
    try:
        try:
            raw = await asyncio.wait_for(
                _exchange(process, content, bounds.max_text_bytes * 6 + bounds.max_pages * 64 + 1024),
                timeout=settings.document_parser_timeout_seconds,
            )
        except TimeoutError as error:
            raise rejection("DOCUMENT_RESOURCE_LIMIT") from error
        if process.returncode != 0:
            raise rejection("DOCUMENT_RESOURCE_LIMIT")
        return decode_pages(raw, bounds)
    finally:
        if process.returncode is None:
            try:
                process.kill()
            except ProcessLookupError:
                pass
        await process.wait()
