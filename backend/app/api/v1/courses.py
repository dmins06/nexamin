import uuid

from fastapi import APIRouter, Query, Response, status

from app.dependencies import CurrentUser, DBSession
from app.schemas import (
    AcademicSummaryResponse,
    CourseCreate,
    CourseResponse,
    CourseUpdate,
    Page,
    TopicCreate,
    TopicResponse,
)
from app.services.courses import CourseService
from app.services.grading import academic_summary

router = APIRouter(prefix="/courses", tags=["Courses"])


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    payload: CourseCreate, session: DBSession, user: CurrentUser
) -> CourseResponse:
    return CourseResponse.model_validate(await CourseService(session, user.id).create(payload))


@router.get("", response_model=Page[CourseResponse])
async def list_courses(
    session: DBSession,
    user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Page[CourseResponse]:
    items, total = await CourseService(session, user.id).list(page, page_size)
    return Page(
        items=[CourseResponse.model_validate(row) for row in items],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/summary/academic", response_model=AcademicSummaryResponse)
async def get_academic_summary(session: DBSession, user: CurrentUser) -> AcademicSummaryResponse:
    return AcademicSummaryResponse.model_validate(await academic_summary(session, user))


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(course_id: uuid.UUID, session: DBSession, user: CurrentUser) -> CourseResponse:
    return CourseResponse.model_validate(await CourseService(session, user.id).get(course_id))


@router.patch("/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: uuid.UUID, payload: CourseUpdate, session: DBSession, user: CurrentUser
) -> CourseResponse:
    return CourseResponse.model_validate(
        await CourseService(session, user.id).update(course_id, payload)
    )


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(course_id: uuid.UUID, session: DBSession, user: CurrentUser) -> Response:
    await CourseService(session, user.id).delete(course_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{course_id}/topics", response_model=TopicResponse, status_code=status.HTTP_201_CREATED
)
async def create_topic(
    course_id: uuid.UUID, payload: TopicCreate, session: DBSession, user: CurrentUser
) -> TopicResponse:
    return TopicResponse.model_validate(
        await CourseService(session, user.id).create_topic(course_id, payload)
    )


@router.get("/{course_id}/topics", response_model=list[TopicResponse])
async def list_topics(
    course_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> list[TopicResponse]:
    rows = await CourseService(session, user.id).list_topics(course_id)
    return [TopicResponse.model_validate(row) for row in rows]
