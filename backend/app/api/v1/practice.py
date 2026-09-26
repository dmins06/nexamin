import uuid

from fastapi import APIRouter, Response, status

from app.dependencies import CurrentUser, DBSession
from app.schemas.practice import (
    PracticeAnswerSave,
    PracticeAttemptView,
    PracticeChapterSummary,
    PracticeExamSummary,
    PracticeHistoryItem,
    PracticeQuestionReportCreate,
    PracticeRandomRequest,
    PracticeResult,
    PracticeSubjectSummary,
    PracticeTopicAccuracy,
)
from app.services.practice import PracticeService

router = APIRouter(prefix="/practice", tags=["Practice"])


@router.get("/subjects", response_model=list[PracticeSubjectSummary])
async def subjects(session: DBSession, user: CurrentUser) -> list[PracticeSubjectSummary]:
    return await PracticeService(session, user.id).subjects()


@router.get("/subjects/{subject_id}/exams", response_model=list[PracticeExamSummary])
async def exams(
    subject_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> list[PracticeExamSummary]:
    return await PracticeService(session, user.id).exams(subject_id)


@router.get("/subjects/{subject_id}/chapters", response_model=list[PracticeChapterSummary])
async def chapters(
    subject_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> list[PracticeChapterSummary]:
    return await PracticeService(session, user.id).chapters(subject_id)


@router.post("/exams/random", response_model=PracticeExamSummary, status_code=201)
async def random_exam(
    payload: PracticeRandomRequest, session: DBSession, user: CurrentUser
) -> PracticeExamSummary:
    return await PracticeService(session, user.id).create_random_exam(payload)


@router.post("/exams/{exam_id}/start", response_model=PracticeAttemptView, status_code=201)
async def start(
    exam_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> PracticeAttemptView:
    return await PracticeService(session, user.id).start(exam_id)


@router.post(
    "/attempts/{attempt_id}/mistakes-exam",
    response_model=PracticeExamSummary,
    status_code=201,
)
async def mistakes_exam(
    attempt_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> PracticeExamSummary:
    return await PracticeService(session, user.id).create_mistakes_exam(attempt_id)


@router.get("/attempts/{attempt_id}", response_model=PracticeAttemptView)
async def load(
    attempt_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> PracticeAttemptView:
    return await PracticeService(session, user.id).load(attempt_id)


@router.patch(
    "/attempts/{attempt_id}/questions/{attempt_question_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def save_answer(
    attempt_id: uuid.UUID,
    attempt_question_id: uuid.UUID,
    payload: PracticeAnswerSave,
    session: DBSession,
    user: CurrentUser,
) -> Response:
    await PracticeService(session, user.id).save_answer(attempt_id, attempt_question_id, payload)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/attempts/{attempt_id}/submit", response_model=PracticeResult)
async def submit(
    attempt_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> PracticeResult:
    return await PracticeService(session, user.id).submit(attempt_id)


@router.get("/attempts/{attempt_id}/result", response_model=PracticeResult)
async def result(
    attempt_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> PracticeResult:
    return await PracticeService(session, user.id).result(attempt_id)


@router.get("/history", response_model=list[PracticeHistoryItem])
async def history(
    session: DBSession, user: CurrentUser, subject_id: uuid.UUID | None = None
) -> list[PracticeHistoryItem]:
    return await PracticeService(session, user.id).history(subject_id)


@router.get("/subjects/{subject_id}/weak-topics", response_model=list[PracticeTopicAccuracy])
async def weak_topics(
    subject_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> list[PracticeTopicAccuracy]:
    return await PracticeService(session, user.id).weak_topics(subject_id)


@router.post("/reports", status_code=status.HTTP_204_NO_CONTENT)
async def report(
    payload: PracticeQuestionReportCreate, session: DBSession, user: CurrentUser
) -> Response:
    await PracticeService(session, user.id).report(payload)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
