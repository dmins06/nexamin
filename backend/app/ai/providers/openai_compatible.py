import json
from collections.abc import AsyncIterator
from typing import TypeVar

import httpx
from pydantic import BaseModel

from app.ai.providers.base import LLMProvider
from app.core.exceptions import AppError

T = TypeVar("T", bound=BaseModel)


class OpenAICompatibleProvider(LLMProvider):
    def __init__(self, base_url: str, model: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self._model = model
        self.headers = {"Authorization": f"Bearer {api_key}"}

    @property
    def model_name(self) -> str:
        return self._model

    async def generate(self, prompt: str, *, system: str | None = None) -> str:
        messages = ([{"role": "system", "content": system}] if system else []) + [
            {"role": "user", "content": prompt}
        ]
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(120, connect=10)) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self.headers,
                    json={"model": self._model, "messages": messages},
                )
        except httpx.TimeoutException as exc:
            raise AppError("AI_TIMEOUT", "Mô hình phản hồi quá lâu. Hãy thử lại.", 504) from exc
        except httpx.RequestError as exc:
            raise AppError("AI_UNAVAILABLE", "Không kết nối được mô hình AI. Hãy thử lại.", 503) from exc
        if response.status_code in (401, 403):
            raise AppError("AI_INVALID_KEY", "API key AI không hợp lệ hoặc chưa được cấp quyền.", 503)
        if response.status_code == 429:
            raise AppError("AI_RATE_LIMIT", "Mô hình AI đã hết hạn mức tạm thời. Hãy thử lại sau.", 429)
        if response.is_error:
            raise AppError("AI_PROVIDER_ERROR", "Mô hình AI chưa xử lý được yêu cầu. Kiểm tra tên model và thử lại.", 503)
        try:
            content = response.json()["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise AppError("AI_INVALID_RESPONSE", "Mô hình AI trả về dữ liệu không hợp lệ.", 502) from exc
        if not isinstance(content, str) or not content.strip():
            raise AppError("AI_EMPTY_RESPONSE", "Mô hình AI chưa tạo được câu trả lời. Hãy thử lại.", 502)
        return content

    async def stream(self, prompt: str, *, system: str | None = None) -> AsyncIterator[str]:
        yield await self.generate(prompt, system=system)

    async def structured_generate(
        self, prompt: str, schema: type[T], *, system: str | None = None
    ) -> T:
        text = await self.generate(
            prompt + "\nReturn only valid JSON matching: " + json.dumps(schema.model_json_schema()),
            system=system,
        )
        return schema.model_validate_json(text)
