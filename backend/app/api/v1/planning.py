import uuid
from datetime import datetime

from fastapi import APIRouter, Query, Response, status
from sqlalchemy import select

from app.dependencies import CurrentUser, DBSession
from app.models import CalendarEvent, TopicMastery
from app.schemas import (
    DeadlineCreate,
    DeadlineResponse,
    DeadlineUpdate,
    EventCreate,
    EventResponse,
    Page,
    TopicMasteryResponse,
)
from app.services.planning import PlanningService

deadline_router = APIRouter(prefix="/deadlines", tags=["Deadlines"])
calendar_router = APIRouter(prefix="/calendar", tags=["Calendar"])
progress_router = APIRouter(prefix="/progress", tags=["Progress"])


@deadline_router.post("", response_model=DeadlineResponse, status_code=status.HTTP_201_CREATED)
async def create_deadline(
    payload: DeadlineCreate, session: DBSession, user: CurrentUser
) -> DeadlineResponse:
    return DeadlineResponse.model_validate(
        await PlanningService(session, user.id).create_deadline(payload)
    )


@deadline_router.get("", response_model=Page[DeadlineResponse])
async def list_deadlines(
    session: DBSession,
    user: CurrentUser,
    scope: str | None = Query(default=None, pattern="^(overdue|upcoming)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Page[DeadlineResponse]:
    rows, total = await PlanningService(session, user.id).list_deadlines(page, page_size, scope)
    return Page(
        items=[DeadlineResponse.model_validate(row) for row in rows],
        page=page,
        page_size=page_size,
        total=total,
    )


@deadline_router.patch("/{deadline_id}", response_model=DeadlineResponse)
async def update_deadline(
    deadline_id: uuid.UUID, payload: DeadlineUpdate, session: DBSession, user: CurrentUser
) -> DeadlineResponse:
    return DeadlineResponse.model_validate(
        await PlanningService(session, user.id).update_deadline(deadline_id, payload)
    )


@deadline_router.delete("/{deadline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deadline(
    deadline_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> Response:
    await PlanningService(session, user.id).delete_deadline(deadline_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@calendar_router.get("", response_model=list[EventResponse])
async def get_calendar(
    session: DBSession,
    user: CurrentUser,
    start: datetime | None = None,
    end: datetime | None = None,
) -> list[EventResponse]:
    filters = [CalendarEvent.user_id == user.id]
    if start:
        filters.append(CalendarEvent.end_at >= start)
    if end:
        filters.append(CalendarEvent.start_at <= end)
    rows = list(
        (
            await session.scalars(
                select(CalendarEvent).where(*filters).order_by(CalendarEvent.start_at)
            )
        ).all()
    )
    return [EventResponse.model_validate(row) for row in rows]


@calendar_router.post("/events", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    payload: EventCreate, session: DBSession, user: CurrentUser
) -> EventResponse:
    return EventResponse.model_validate(
        await PlanningService(session, user.id).create_event(payload)
    )


@calendar_router.patch("/events/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: uuid.UUID, payload: EventCreate, session: DBSession, user: CurrentUser
) -> EventResponse:
    return EventResponse.model_validate(
        await PlanningService(session, user.id).update_event(event_id, payload)
    )


@calendar_router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(event_id: uuid.UUID, session: DBSession, user: CurrentUser) -> Response:
    await PlanningService(session, user.id).delete_event(event_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@progress_router.get("", response_model=list[TopicMasteryResponse])
async def get_progress(
    session: DBSession, user: CurrentUser, course_id: uuid.UUID | None = None
) -> list[TopicMasteryResponse]:
    filters = [TopicMastery.user_id == user.id]
    if course_id:
        filters.append(TopicMastery.course_id == course_id)
    rows = list(
        (
            await session.scalars(
                select(TopicMastery).where(*filters).order_by(TopicMastery.mastery_score.desc())
            )
        ).all()
    )
    return [TopicMasteryResponse.model_validate(row) for row in rows]
