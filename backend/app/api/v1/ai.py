from fastapi import APIRouter

from app.ai.embeddings import OllamaEmbeddingProvider
from app.ai.providers import OllamaProvider
from app.dependencies import CurrentUser, DBSession
from app.schemas import ChatRequest, ChatResponse
from app.services.tutor import TutorService

router = APIRouter(prefix="/ai", tags=["AI Tutor"])


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, session: DBSession, user: CurrentUser) -> ChatResponse:
    return await TutorService(session, user.id, OllamaProvider(), OllamaEmbeddingProvider()).chat(
        payload
    )
