"""Gemini via Google's OpenAI-compatible REST endpoint."""

from app.ai.providers.openai_compatible import OpenAICompatibleProvider
from app.config import settings


class GeminiProvider(OpenAICompatibleProvider):
    def __init__(self) -> None:
        super().__init__(
            "https://generativelanguage.googleapis.com/v1beta/openai",
            settings.gemini_model,
            settings.gemini_api_key,
        )
