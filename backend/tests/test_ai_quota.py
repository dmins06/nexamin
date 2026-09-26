import uuid
from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from starlette.requests import Request

from app.config import settings
from app.core.ai_quota import enforce_gemini_quota, quota_window
from app.core.exceptions import AppError


class FakePipeline:
    def __init__(self, counts: dict[str, int]) -> None:
        self.counts = counts
        self.key = ""

    async def __aenter__(self) -> "FakePipeline":
        return self

    async def __aexit__(self, *_: object) -> None:
        return None

    def incr(self, key: str) -> None:
        self.key = key

    def expire(self, _: str, __: int, *, nx: bool) -> None:
        assert nx

    async def execute(self) -> tuple[int, bool]:
        self.counts[self.key] = self.counts.get(self.key, 0) + 1
        return self.counts[self.key], True


class FakeRedis:
    def __init__(self) -> None:
        self.counts: dict[str, int] = {}

    def pipeline(self, *, transaction: bool) -> FakePipeline:
        assert transaction
        return FakePipeline(self.counts)


def test_quota_window_uses_pacific_day() -> None:
    day, ttl = quota_window(datetime(2026, 9, 26, 3, 0, tzinfo=UTC))
    assert day == "2026-09-25"
    assert 0 < ttl <= 25 * 3600 + 60


@pytest.mark.asyncio
async def test_gemini_daily_limit_is_per_account(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    monkeypatch.setattr(settings, "gemini_daily_user_limit", 2)
    app = FastAPI()
    app.state.redis = FakeRedis()
    request = Request({"type": "http", "app": app, "method": "POST", "path": "/api/v1/ai/chat"})
    first = uuid.uuid4()
    second = uuid.uuid4()

    await enforce_gemini_quota(request, first)
    await enforce_gemini_quota(request, first)
    with pytest.raises(AppError) as error:
        await enforce_gemini_quota(request, first)
    assert error.value.code == "AI_DAILY_LIMIT"
    assert error.value.status_code == 429
    await enforce_gemini_quota(request, second)
