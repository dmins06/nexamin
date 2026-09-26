import json

import httpx
import pytest

from app.ai.providers.gemini import GeminiProvider
from app.api.v1.ai import _provider
from app.config import settings
from app.core.exceptions import AppError


@pytest.mark.asyncio
async def test_gemini_uses_server_key_and_returns_answer(monkeypatch: pytest.MonkeyPatch) -> None:
    original_client = httpx.AsyncClient
    monkeypatch.setattr(settings, "gemini_api_key", "test-key-from-server")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "generativelanguage.googleapis.com"
        assert request.url.path == "/v1beta/openai/chat/completions"
        assert request.headers["Authorization"] == "Bearer test-key-from-server"
        payload = json.loads(request.content)
        assert payload["model"] == settings.gemini_model
        assert payload["messages"][0]["role"] == "system"
        return httpx.Response(200, json={"choices": [{"message": {"content": "Đáp án là 4."}}]})

    monkeypatch.setattr(
        "app.ai.providers.openai_compatible.httpx.AsyncClient",
        lambda **kwargs: original_client(transport=httpx.MockTransport(handler), **kwargs),
    )
    assert await GeminiProvider().generate("2 + 2?", system="Trả lời bằng tiếng Việt") == "Đáp án là 4."


def test_gemini_requires_server_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "llm_provider", "gemini")
    monkeypatch.setattr(settings, "gemini_api_key", "")
    with pytest.raises(AppError, match="quản trị viên"):
        _provider()


@pytest.mark.asyncio
async def test_gemini_invalid_key_is_actionable(monkeypatch: pytest.MonkeyPatch) -> None:
    original_client = httpx.AsyncClient
    monkeypatch.setattr(settings, "gemini_api_key", "invalid-test-key")
    monkeypatch.setattr(
        "app.ai.providers.openai_compatible.httpx.AsyncClient",
        lambda **kwargs: original_client(
            transport=httpx.MockTransport(lambda _: httpx.Response(401)), **kwargs
        ),
    )
    with pytest.raises(AppError, match="API key AI không hợp lệ"):
        await GeminiProvider().generate("Xin chào")
