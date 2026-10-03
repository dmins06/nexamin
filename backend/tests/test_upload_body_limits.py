"""ASGI receive/admission contracts; all request bytes are small synthetic data."""
import asyncio

import httpx
import pytest
from fastapi import FastAPI, File, UploadFile

from app.config import settings
from app.core.upload_limits import MULTIPART_ALLOWANCE, UploadLimitsMiddleware


def scope(path="/api/v1/documents/upload", headers=None):
    return {"type": "http", "method": "POST", "path": path, "headers": headers or [], "http_version": "1.1"}


@pytest.mark.asyncio
@pytest.mark.parametrize("declared", [None, b"1", b"999999"])
async def test_declared_and_streaming_body_overflow_stop_before_handler(declared, monkeypatch):
    monkeypatch.setattr(settings, "max_upload_bytes", 10)
    received = 0
    processed = []
    sent = []
    parts = [b"x" * MULTIPART_ALLOWANCE, b"x" * 11, b"never consumed"]

    async def receive():
        nonlocal received
        data = parts[received]
        received += 1
        return {"type": "http.request", "body": data, "more_body": received < len(parts)}

    async def app(request_scope, request_receive, send):
        while (await request_receive()).get("more_body", False):
            pass
        processed.append(True)
        await send({"type": "http.response.start", "status": 200})

    async def send(message):
        sent.append(message)

    middleware = UploadLimitsMiddleware(app)
    await middleware(scope(headers=[] if declared is None else [(b"content-length", declared)]), receive, send)
    assert sent[0]["status"] == 413
    assert processed == []
    assert received == (0 if declared == b"999999" else 2)
    assert middleware.active == 0


@pytest.mark.asyncio
async def test_real_multipart_parser_returns_standard_413_and_does_not_run_handler(monkeypatch):
    monkeypatch.setattr(settings, "max_upload_bytes", 10)
    app = FastAPI()
    processed = []

    @app.post("/api/v1/documents/upload")
    async def upload(file: UploadFile = File()):
        processed.append(True)
        return {"bytes": len(await file.read())}

    app.add_middleware(UploadLimitsMiddleware)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://localhost") as client:
        response = await client.post("/api/v1/documents/upload", files={"file": ("fixture.txt", b"x" * (2 * MULTIPART_ALLOWANCE), "text/plain")})
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "UPLOAD_BODY_TOO_LARGE"
    assert processed == []


@pytest.mark.asyncio
async def test_inflight_admission_and_cancellation_leave_health_and_next_upload_available(monkeypatch):
    monkeypatch.setattr(settings, "upload_concurrency", 1)
    entered = asyncio.Event()
    release = asyncio.Event()

    async def app(request_scope, receive, send):
        if request_scope["path"].endswith("/upload"):
            entered.set()
            await release.wait()
        await send({"type": "http.response.start", "status": 200})
        await send({"type": "http.response.body", "body": b"ok"})

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    first_sent = []

    async def first_send(message):
        first_sent.append(message)

    middleware = UploadLimitsMiddleware(app)
    task = asyncio.create_task(middleware(scope(), receive, first_send))
    await entered.wait()
    other_sent = []

    async def other_send(message):
        other_sent.append(message)

    await middleware(scope(), receive, other_send)
    assert other_sent[0]["status"] == 503
    assert (b"retry-after", b"5") in other_sent[0]["headers"]
    health_sent = []

    async def health_send(message):
        health_sent.append(message)

    await middleware(scope("/health/ready"), receive, health_send)
    assert health_sent[0]["status"] == 200
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert middleware.active == 0
    release.set()
    await middleware(scope(), receive, first_send)
    assert first_sent[0]["status"] == 200


def test_all_upload_routes_have_caps():
    async def app(request_scope, receive, send):
        pass

    middleware = UploadLimitsMiddleware(app)
    for path in ["/documents/upload", "/social/messages/upload", "/social/posts/upload", "/users/me/avatar"]:
        assert middleware.body_limit(settings.api_v1_prefix + path) is not None
    assert middleware.body_limit(settings.api_v1_prefix + "/auth/login") is None


@pytest.mark.asyncio
async def test_chunked_multipart_overflow_is_not_changed_to_fastapi_400(monkeypatch):
    monkeypatch.setattr(settings, "max_upload_bytes", 10)
    app = FastAPI()
    processed = []

    @app.post("/api/v1/documents/upload")
    async def upload(file: UploadFile = File()):
        processed.append(True)
        return {"bytes": len(await file.read())}

    app.add_middleware(UploadLimitsMiddleware)

    async def body():
        yield b'--fixture\r\nContent-Disposition: form-data; name="file"; filename="fixture.txt"\r\n\r\n'
        yield b"x" * (2 * MULTIPART_ALLOWANCE)
        yield b"\r\n--fixture--\r\n"

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://localhost") as client:
        response = await client.post("/api/v1/documents/upload", content=body(), headers={"Content-Type": "multipart/form-data; boundary=fixture"})
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "UPLOAD_BODY_TOO_LARGE"
    assert processed == []


@pytest.mark.asyncio
async def test_slow_body_times_out_and_releases_upload_admission(monkeypatch):
    from types import SimpleNamespace

    from app.core import upload_limits

    monkeypatch.setattr(upload_limits, "settings", SimpleNamespace(
        api_v1_prefix=settings.api_v1_prefix, max_upload_bytes=settings.max_upload_bytes,
        upload_concurrency=settings.upload_concurrency, upload_body_timeout_seconds=0.02,
    ))
    processed = []
    sent = []

    async def app(request_scope, receive, send):
        await receive()
        processed.append(True)
        await send({"type": "http.response.start", "status": 200})
        await send({"type": "http.response.body", "body": b"ok"})

    async def slow_receive():
        await asyncio.sleep(0.1)
        return {"type": "http.request", "body": b"synthetic", "more_body": False}

    async def send(message):
        sent.append(message)

    middleware = UploadLimitsMiddleware(app)
    await middleware(scope(), slow_receive, send)
    assert sent[0]["status"] == 408
    assert processed == []
    assert middleware.active == 0
