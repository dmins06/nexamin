import json
from unittest.mock import AsyncMock

import httpx
import pytest

from app.ai.providers.auto import AutoEminProvider
from app.ai.providers.ollama import OllamaProvider
from app.core.exceptions import AppError


@pytest.mark.asyncio
async def test_ollama_returns_answer_without_reasoning(monkeypatch: pytest.MonkeyPatch) -> None:
    original_client = httpx.AsyncClient

    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        assert payload["model"] == "qwen3:4b"
        assert payload["think"] is False
        assert payload["stream"] is False
        assert payload["format"]["required"] == ["answer"]
        return httpx.Response(200, json={"response": '{"answer":"Đáp án là 4."}'})

    monkeypatch.setattr(
        "app.ai.providers.ollama.httpx.AsyncClient",
        lambda **kwargs: original_client(transport=httpx.MockTransport(handler), **kwargs),
    )
    answer = await OllamaProvider(base_url="http://ollama.test", model="qwen3:4b").generate(
        "2 + 2 bằng mấy?"
    )
    assert answer == "Đáp án là 4."


@pytest.mark.asyncio
async def test_missing_model_reports_actionable_error(monkeypatch: pytest.MonkeyPatch) -> None:
    original_client = httpx.AsyncClient
    monkeypatch.setattr(
        "app.ai.providers.ollama.httpx.AsyncClient",
        lambda **kwargs: original_client(
            transport=httpx.MockTransport(lambda _: httpx.Response(404)), **kwargs
        ),
    )
    with pytest.raises(AppError, match="ollama pull qwen3:4b"):
        await OllamaProvider(base_url="http://ollama.test", model="qwen3:4b").generate("Hi")


@pytest.mark.asyncio
async def test_auto_mode_falls_back_when_ollama_is_unavailable() -> None:
    provider = AutoEminProvider()
    provider.ollama.generate = AsyncMock(
        side_effect=AppError("OLLAMA_UNAVAILABLE", "Ollama unavailable", 503)
    )
    result = await provider.generate("Câu hỏi của sinh viên:\nXin chào")
    assert "Ollama hiện chưa sẵn sàng" in result
    assert "Chào bạn" in result
