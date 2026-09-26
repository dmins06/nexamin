import uuid

from fastapi import APIRouter, Request, status
from sqlalchemy import select

from app.api.v1.ai import _provider
from app.core.ai_quota import enforce_gemini_quota
from app.dependencies import CurrentUser, DBSession
from app.models import Question
from app.repositories.scoped import owned_quiz
from app.schemas import (
    QuestionPublic,
    QuizGenerateRequest,
    QuizResponse,
    QuizResult,
    QuizSubmitRequest,
)
from app.services.quizzes import QuizService

router = APIRouter(prefix="/quizzes", tags=["Quiz"])


async def quiz_response(quiz_id: uuid.UUID, session: DBSession, user_id: uuid.UUID) -> QuizResponse:
    quiz = await owned_quiz(session, quiz_id, user_id)
    questions = list(
        (await session.scalars(select(Question).where(Question.quiz_id == quiz.id))).all()
    )
    response = QuizResponse.model_validate(quiz)
    response.questions = [QuestionPublic.model_validate(row) for row in questions]
    return response


@router.post("/generate", response_model=QuizResponse, status_code=status.HTTP_201_CREATED)
async def generate_quiz(
    payload: QuizGenerateRequest, session: DBSession, user: CurrentUser, request: Request
) -> QuizResponse:
    provider = _provider()
    await enforce_gemini_quota(request, user.id)
    quiz = await QuizService(session, user.id, provider).generate(payload)
    return await quiz_response(quiz.id, session, user.id)


@router.get("/{quiz_id}", response_model=QuizResponse)
async def get_quiz(quiz_id: uuid.UUID, session: DBSession, user: CurrentUser) -> QuizResponse:
    return await quiz_response(quiz_id, session, user.id)


@router.post("/{quiz_id}/submit", response_model=QuizResult)
async def submit_quiz(
    quiz_id: uuid.UUID, payload: QuizSubmitRequest, session: DBSession, user: CurrentUser
) -> QuizResult:
    return await QuizService(session, user.id, None).submit(quiz_id, payload)
