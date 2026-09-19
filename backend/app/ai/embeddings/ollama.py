import httpx

from app.ai.embeddings.base import EmbeddingProvider
from app.config import settings
from app.core.exceptions import AppError


class OllamaEmbeddingProvider(EmbeddingProvider):
    async def embed_text(self, text: str) -> list[float]:
        values = await self.embed_batch([text])
        return values[0]

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        async with httpx.AsyncClient(timeout=180) as client:
            response = await client.post(
                f"{settings.ollama_base_url.rstrip('/')}/api/embed",
                json={"model": settings.embedding_model, "input": texts},
            )
        if response.is_error:
            raise AppError("EMBEDDING_PROVIDER_ERROR", "Embedding provider is unavailable", 503)
        return [[float(value) for value in vector] for vector in response.json()["embeddings"]]
