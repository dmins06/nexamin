import httpx

from app.ai.embeddings.base import EmbeddingProvider
from app.config import settings
from app.core.exceptions import AppError


class OllamaEmbeddingProvider(EmbeddingProvider):
    async def embed_text(self, text: str) -> list[float]:
        values = await self.embed_batch([text])
        return values[0]

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        headers = (
            {"Authorization": f"Bearer {settings.ollama_api_key}"}
            if settings.ollama_api_key
            else {}
        )
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(180, connect=5)) as client:
                response = await client.post(
                    f"{settings.ollama_base_url.rstrip('/')}/api/embed",
                    json={"model": settings.embedding_model, "input": texts},
                    headers=headers,
                )
        except (httpx.TimeoutException, httpx.RequestError) as exc:
            raise AppError(
                "EMBEDDING_UNAVAILABLE", "Không kết nối được Ollama embedding.", 503
            ) from exc
        if response.is_error:
            raise AppError(
                "EMBEDDING_UNAVAILABLE",
                f"Ollama embedding chưa sẵn sàng: {settings.embedding_model}.",
                503,
            )
        try:
            vectors = response.json()["embeddings"]
            if len(vectors) != len(texts) or any(
                len(vector) != settings.embedding_dimensions for vector in vectors
            ):
                raise ValueError("Embedding dimensions do not match the database schema")
            return [[float(value) for value in vector] for vector in vectors]
        except (ValueError, TypeError, KeyError) as exc:
            raise AppError(
                "EMBEDDING_INVALID_RESPONSE",
                "Ollama embedding trả về dữ liệu không phù hợp cấu hình.",
                502,
            ) from exc
