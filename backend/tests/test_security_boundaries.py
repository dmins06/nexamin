"""Boundary/abuse tests use synthetic input, a memory DB and mocked services."""

import uuid

import httpx
import pytest
from fastapi import FastAPI
from pydantic import ValidationError
from redis.exceptions import ConnectionError as RedisConnectionError
from starlette.requests import Request

from app.ai.rag import PermissionScopedRetriever
from app.api.v1.auth import PasswordResetPayload
from app.config import settings
from app.core.ai_quota import enforce_gemini_quota
from app.core.exceptions import AppError
from app.models import Course, Document, DocumentChunk
from app.schemas import GoogleAuthRequest, LoginRequest, PasswordChangeRequest, RefreshRequest


@pytest.mark.parametrize("schema,payload", [
    (LoginRequest, {"email": "fixture@example.edu", "password": "x" * 129}),
    (PasswordChangeRequest, {"current_password": "x" * 129, "new_password": "Synthetic123"}),
    (RefreshRequest, {"refresh_token": "x" * 257}),
    (PasswordResetPayload, {"token": "x" * 4097, "new_password": "Synthetic123"}),
    (GoogleAuthRequest, {"authorization_code": "x" * 4097}),
])
def test_oversized_auth_input_is_rejected_before_credential_processing(schema, payload):
    with pytest.raises(ValidationError):
        schema.model_validate(payload)


def test_normal_auth_inputs_are_still_accepted():
    assert LoginRequest(email="fixture@example.edu", password="abc123").password == "abc123"
    assert len(RefreshRequest(refresh_token="x" * 64).refresh_token) == 64


@pytest.mark.asyncio
async def test_real_lexical_retrieval_cannot_cross_owner_or_course_boundaries(session, users):
    owner, stranger = users
    courses = [Course(id=uuid.uuid4(), owner_id=user.id, name=name) for user, name in (
        (owner, "Selected course"), (owner, "Other course"), (stranger, "Private course"),
    )]
    session.add_all(courses)
    await session.flush()
    for index, course in enumerate(courses):
        document = Document(
            id=uuid.uuid4(), user_id=course.owner_id, course_id=course.id,
            filename=f"fixture-{index}.txt", original_filename=f"fixture-{index}.txt",
            mime_type="text/plain", size=16, storage_key=f"synthetic/{index}",
        )
        session.add(document)
        session.add(DocumentChunk(
            id=uuid.uuid4(), document_id=document.id, course_id=course.id,
            chunk_index=0, content=f"Only fixture {index}", embedding=[0.0] * 768,
        ))
    await session.commit()
    retriever = PermissionScopedRetriever(session)
    selected = await retriever.retrieve_lexical(user_id=owner.id, course_id=courses[0].id)
    assert [chunk.content for chunk in selected] == ["Only fixture 0"]
    assert await retriever.retrieve_lexical(user_id=stranger.id, course_id=courses[0].id) == []
    assert await retriever.retrieve_lexical(user_id=owner.id, course_id=courses[2].id) == []


@pytest.mark.asyncio
async def test_shared_gemini_quota_fails_closed_when_redis_is_down(monkeypatch):
    class UnavailableRedis:
        def pipeline(self, *, transaction):
            assert transaction
            raise RedisConnectionError("synthetic Redis outage")

    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    monkeypatch.setattr(settings, "gemini_daily_user_limit", 2)
    app = FastAPI()
    app.state.redis = UnavailableRedis()
    request = Request({"type": "http", "app": app, "method": "POST", "path": "/api/v1/ai/chat"})
    with pytest.raises(AppError) as error:
        await enforce_gemini_quota(request, uuid.uuid4())
    assert error.value.code == "AI_QUOTA_UNAVAILABLE"
    assert error.value.status_code == 503


@pytest.mark.asyncio
async def test_real_backend_adds_nonvisual_security_headers(monkeypatch):
    from app.main import app

    monkeypatch.setattr(settings, "app_env", "test")
    monkeypatch.setattr(settings, "rate_limit_enabled", False)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://127.0.0.1"
    ) as client:
        response = await client.get("/health/live")
    assert response.status_code == 200
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("Referrer-Policy") == "no-referrer"
    assert response.headers.get("X-Frame-Options") == "DENY"
