from fastapi import APIRouter, Request

from app.ai.providers import (
    EminLocalProvider,
    GeminiProvider,
    OpenAICompatibleProvider,
)
from app.ai.providers.base import LLMProvider
from app.config import settings
from app.core.ai_quota import enforce_gemini_quota
from app.core.exceptions import AppError
from app.dependencies import CurrentUser, DBSession
from app.schemas import ChatRequest, ChatResponse
from app.services.tutor import TutorService

router = APIRouter(prefix="/ai", tags=["AI Tutor"])


def _provider() -> LLMProvider:
    if settings.llm_provider == "gemini":
        if not settings.gemini_api_key:
            raise AppError(
                "GEMINI_KEY_MISSING",
                "Emin AI chưa được cấu hình API key Gemini. Hãy liên hệ quản trị viên.",
                503,
            )
        return GeminiProvider()
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
async def chat(
    payload: ChatRequest, session: DBSession, user: CurrentUser, request: Request
) -> ChatResponse:
    provider = _provider()
    await enforce_gemini_quota(request, user.id)
    return await TutorService(session, user.id, provider).chat(payload)
