"""Reject oversized/too many upload bodies before multipart parsing or spooling."""
import asyncio
import json

from starlette.exceptions import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import settings

MULTIPART_ALLOWANCE = 64 * 1024


class UploadLimitsMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app
        self.active = 0

    def body_limit(self, path: str) -> int | None:
        prefix = settings.api_v1_prefix
        limits = {
            f"{prefix}/documents/upload": settings.max_upload_bytes,
            f"{prefix}/social/messages/upload": 10 * 1024 * 1024,
            f"{prefix}/social/posts/upload": 5 * 1024 * 1024,
            f"{prefix}/users/me/avatar": 5 * 1024 * 1024,
        }
        size = limits.get(path)
        return None if size is None else size + MULTIPART_ALLOWANCE

    async def error(self, scope: Scope, send: Send, status: int, code: str, message: str) -> None:
        content = json.dumps({"error": {"code": code, "message": message}}).encode()
        headers = [(b"content-type", b"application/json"), (b"cache-control", b"private, no-store"),
                   (b"content-length", str(len(content)).encode())]
        if status == 503:
            headers.append((b"retry-after", b"5"))
        if scope.get("http_version") in ("1.0", "1.1"):
            headers.append((b"connection", b"close"))
        await send({"type": "http.response.start", "status": status, "headers": headers})
        await send({"type": "http.response.body", "body": content})

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        maximum = self.body_limit(scope.get("path", ""))
        if scope["type"] != "http" or scope.get("method") != "POST" or maximum is None:
            await self.app(scope, receive, send)
            return
        for key, value in scope.get("headers", []):
            if key.lower() == b"content-length":
                if not value.isdigit():
                    await self.error(scope, send, 400, "INVALID_CONTENT_LENGTH", "Kích thước request không hợp lệ.")
                    return
                if len(value) > 20 or int(value) > maximum:
                    await self.error(scope, send, 413, "UPLOAD_BODY_TOO_LARGE", "File tải lên vượt giới hạn dung lượng.")
                    return
        if self.active >= settings.upload_concurrency:
            await self.error(scope, send, 503, "UPLOAD_BUSY", "Đang xử lý file khác. Vui lòng thử lại sau.")
            return
        self.active += 1
        consumed = 0
        failure: tuple[int, str, str] | None = None
        responded = False
        complete = False
        deadline = asyncio.get_running_loop().time() + settings.upload_body_timeout_seconds

        async def bounded_receive() -> Message:
            nonlocal consumed, failure, complete
            try:
                if complete:
                    message = await receive()
                else:
                    remaining = max(0, deadline - asyncio.get_running_loop().time())
                    message = await asyncio.wait_for(receive(), timeout=remaining)
            except TimeoutError as error:
                failure = (408, "UPLOAD_TIMEOUT", "Quá thời gian tải file. Vui lòng thử lại.")
                raise HTTPException(status_code=408, detail="Upload body timeout") from error
            if message["type"] == "http.request":
                consumed += len(message.get("body", b""))
                if consumed > maximum:
                    failure = (413, "UPLOAD_BODY_TOO_LARGE", "File tải lên vượt giới hạn dung lượng.")
                    raise HTTPException(status_code=413, detail="Upload body limit exceeded")
                complete = not message.get("more_body", False)
            return message

        async def bounded_send(message: Message) -> None:
            nonlocal responded
            if failure is not None:
                if not responded:
                    responded = True
                    await self.error(scope, send, *failure)
                return
            await send(message)

        try:
            try:
                await self.app(scope, bounded_receive, bounded_send)
            except HTTPException:
                if failure is None:
                    raise
                if not responded:
                    await self.error(scope, send, *failure)
        finally:
            self.active -= 1
