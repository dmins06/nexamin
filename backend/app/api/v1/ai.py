from fastapi import APIRouter

from app.ai.embeddings import OllamaEmbeddingProvider
from app.ai.providers import (
    AutoEminProvider,
    EminLocalProvider,
    OllamaProvider,
    OpenAICompatibleProvider,
)
from app.ai.providers.base import LLMProvider
from app.config import settings
from app.core.exceptions import AppError
from app.dependencies import CurrentUser, DBSession
from app.schemas import ChatRequest, ChatResponse
from app.services.tutor import TutorService

router = APIRouter(prefix="/ai", tags=["AI Tutor"])


def _provider() -> LLMProvider:
    if settings.llm_provider == "auto":
        return AutoEminProvider()
    if settings.llm_provider == "ollama":
        return OllamaProvider()
    if settings.llm_provider == "openai-compatible":
        if not all(
            (
                settings.openai_compatible_base_url,
                settings.openai_compatible_api_key,
                settings.openai_compatible_model,
            )
        ):
            raise AppError("AI_CONFIG_ERROR", "OpenAI-compatible provider chưa được cấu hình", 503)
        return OpenAICompatibleProvider(
            settings.openai_compatible_base_url,
            settings.openai_compatible_model,
            settings.openai_compatible_api_key,
        )
    return EminLocalProvider()


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, session: DBSession, user: CurrentUser) -> ChatResponse:
    return await TutorService(session, user.id, _provider(), OllamaEmbeddingProvider()).chat(
        payload
    )
