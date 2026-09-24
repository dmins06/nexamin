from collections.abc import AsyncIterator
from typing import TypeVar

from pydantic import BaseModel

from app.ai.providers.base import LLMProvider
from app.ai.providers.local import EminLocalProvider
from app.ai.providers.ollama import OllamaProvider
from app.core.exceptions import AppError

T = TypeVar("T", bound=BaseModel)


class AutoEminProvider(LLMProvider):
    """Use Ollama when available; retain grounded document answers if it is offline."""

    def __init__(self) -> None:
        self.ollama = OllamaProvider()
        self.local = EminLocalProvider()

    @property
    def model_name(self) -> str:
        return f"auto:{self.ollama.model_name}"

    async def generate(self, prompt: str, *, system: str | None = None) -> str:
        try:
            return await self.ollama.generate(prompt, system=system)
        except AppError as exc:
            if exc.code not in {
                "OLLAMA_UNAVAILABLE",
                "OLLAMA_MODEL_MISSING",
                "OLLAMA_ERROR",
                "OLLAMA_INVALID_RESPONSE",
                "OLLAMA_EMPTY_RESPONSE",
            }:
                raise
            fallback = await self.local.generate(prompt, system=system)
            return (
                "Ollama hiện chưa sẵn sàng; Emin AI đang dùng nội dung tài liệu để hỗ trợ bạn.\n\n"
                + fallback
            )

    async def stream(self, prompt: str, *, system: str | None = None) -> AsyncIterator[str]:
        yield await self.generate(prompt, system=system)

    async def structured_generate(
        self, prompt: str, schema: type[T], *, system: str | None = None
    ) -> T:
        return await self.ollama.structured_generate(prompt, schema, system=system)
