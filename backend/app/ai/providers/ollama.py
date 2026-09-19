import json
from collections.abc import AsyncIterator
from typing import TypeVar

import httpx
from pydantic import BaseModel

from app.ai.providers.base import LLMProvider
from app.config import settings
from app.core.exceptions import AppError

T = TypeVar("T", bound=BaseModel)


class OllamaProvider(LLMProvider):
    def __init__(
        self, base_url: str = settings.ollama_base_url, model: str = settings.ollama_model
    ):
        self.base_url = base_url.rstrip("/")
        self._model = model

    @property
    def model_name(self) -> str:
        return self._model

    async def generate(self, prompt: str, *, system: str | None = None) -> str:
        payload = {"model": self._model, "prompt": prompt, "system": system or "", "stream": False}
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(f"{self.base_url}/api/generate", json=payload)
        if response.is_error:
            raise AppError("AI_PROVIDER_ERROR", "AI provider is unavailable", 503)
        return str(response.json()["response"])

    async def stream(self, prompt: str, *, system: str | None = None) -> AsyncIterator[str]:
        payload = {"model": self._model, "prompt": prompt, "system": system or "", "stream": True}
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST", f"{self.base_url}/api/generate", json=payload
            ) as response:
                if response.is_error:
                    raise AppError("AI_PROVIDER_ERROR", "AI provider is unavailable", 503)
                async for line in response.aiter_lines():
                    if line:
                        yield str(json.loads(line).get("response", ""))

    async def structured_generate(
        self, prompt: str, schema: type[T], *, system: str | None = None
    ) -> T:
        payload = {
            "model": self._model,
            "prompt": prompt,
            "system": system or "",
            "stream": False,
            "format": schema.model_json_schema(),
        }
        async with httpx.AsyncClient(timeout=180) as client:
            response = await client.post(f"{self.base_url}/api/generate", json=payload)
        if response.is_error:
            raise AppError("AI_PROVIDER_ERROR", "AI provider is unavailable", 503)
        return schema.model_validate_json(response.json()["response"])
