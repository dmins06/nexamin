from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class LLMProvider(ABC):
    @property
    @abstractmethod
    def model_name(self) -> str: ...

    @abstractmethod
    async def generate(self, prompt: str, *, system: str | None = None) -> str: ...

    @abstractmethod
    async def stream(self, prompt: str, *, system: str | None = None) -> AsyncIterator[str]:
        if False:
            yield ""

    @abstractmethod
    async def structured_generate(
        self, prompt: str, schema: type[T], *, system: str | None = None
    ) -> T: ...
