import json
from collections.abc import AsyncIterator
from typing import TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.ai.providers.base import LLMProvider
from app.config import settings
from app.core.exceptions import AppError

T = TypeVar("T", bound=BaseModel)

_ANSWER_SCHEMA = {
    "type": "object",
    "properties": {"answer": {"type": "string"}},
    "required": ["answer"],
}


class OllamaProvider(LLMProvider):
    def __init__(self, base_url: str | None = None, model: str | None = None):
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self._model = model or settings.ollama_model
        self.headers = (
            {"Authorization": f"Bearer {settings.ollama_api_key}"}
            if settings.ollama_api_key
            else {}
        )

    @property
    def model_name(self) -> str:
        return self._model

    async def _generate(self, prompt: str, *, system: str | None, format: object) -> str:
        payload = {
            "model": self._model,
            "prompt": prompt,
            "system": system or "",
            "stream": False,
            "think": False,
            "format": format,
        }
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(180, connect=5)) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate", json=payload, headers=self.headers
                )
        except (httpx.TimeoutException, httpx.RequestError) as exc:
            raise AppError(
                "OLLAMA_UNAVAILABLE",
                "Không kết nối được Ollama. Hãy kiểm tra dịch vụ và OLLAMA_BASE_URL.",
                503,
            ) from exc
        if response.status_code == 404:
            raise AppError(
                "OLLAMA_MODEL_MISSING",
                f"Ollama chưa có model {self._model}. Hãy chạy ollama pull {self._model}.",
                503,
            )
        if response.is_error:
            raise AppError("OLLAMA_ERROR", "Ollama chưa thể xử lý yêu cầu. Hãy thử lại sau.", 503)
        try:
            answer = response.json()["response"]
        except (ValueError, KeyError, TypeError) as exc:
            raise AppError(
                "OLLAMA_INVALID_RESPONSE", "Ollama trả về dữ liệu không hợp lệ.", 502
            ) from exc
        if not isinstance(answer, str) or not answer.strip():
            raise AppError("OLLAMA_EMPTY_RESPONSE", "Ollama chưa tạo được câu trả lời.", 502)
        return answer.strip()

    async def generate(self, prompt: str, *, system: str | None = None) -> str:
        text = await self._generate(
            prompt
            + "\n\nTrả về JSON chỉ có khóa answer chứa câu trả lời cuối cùng bằng tiếng Việt.",
            system=system,
            format=_ANSWER_SCHEMA,
        )
        try:
            result = json.loads(text)
            answer = result["answer"]
        except (ValueError, KeyError, TypeError) as exc:
            raise AppError(
                "OLLAMA_INVALID_RESPONSE", "Ollama trả về dữ liệu không hợp lệ.", 502
            ) from exc
        if not isinstance(answer, str) or not answer.strip():
            raise AppError("OLLAMA_EMPTY_RESPONSE", "Ollama chưa tạo được câu trả lời.", 502)
        return answer.strip()

    async def stream(self, prompt: str, *, system: str | None = None) -> AsyncIterator[str]:
        yield await self.generate(prompt, system=system)

    async def structured_generate(
        self, prompt: str, schema: type[T], *, system: str | None = None
    ) -> T:
        text = await self._generate(prompt, system=system, format=schema.model_json_schema())
        try:
            return schema.model_validate_json(text)
        except ValidationError as exc:
            raise AppError(
                "OLLAMA_INVALID_RESPONSE", "Ollama trả về dữ liệu không hợp lệ.", 502
            ) from exc
