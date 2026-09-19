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
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self.headers,
                json={"model": self._model, "messages": messages},
            )
        if response.is_error:
            raise AppError("AI_PROVIDER_ERROR", "AI provider is unavailable", 503)
        return str(response.json()["choices"][0]["message"]["content"])

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
