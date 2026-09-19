import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models import Activity, ActivityType, CalendarEvent, Deadline, DeadlineStatus
from app.repositories.scoped import owned_course, owned_deadline
from app.schemas import DeadlineCreate, DeadlineUpdate, EventCreate


class PlanningService:
    def __init__(self, session: AsyncSession, user_id: uuid.UUID):
        self.session = session
        self.user_id = user_id

    async def create_deadline(self, payload: DeadlineCreate) -> Deadline:
        if payload.course_id:
            await owned_course(self.session, payload.course_id, self.user_id)
        row = Deadline(user_id=self.user_id, **payload.model_dump())
        self.session.add(row)
        await self.session.commit()
        await self.session.refresh(row)
        return row

    async def list_deadlines(
        self, page: int, page_size: int, scope: str | None
    ) -> tuple[list[Deadline], int]:
        filters = [Deadline.user_id == self.user_id]
        now = datetime.now(UTC)
        if scope == "overdue":
            filters += [Deadline.due_at < now, Deadline.status != DeadlineStatus.DONE]
        elif scope == "upcoming":
            filters.append(Deadline.due_at >= now)
        total = (
            await self.session.scalar(select(func.count()).select_from(Deadline).where(*filters))
            or 0
        )
        rows = list(
            (
                await self.session.scalars(
                    select(Deadline)
                    .where(*filters)
                    .order_by(Deadline.due_at)
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).all()
        )
        return rows, total

    async def update_deadline(self, deadline_id: uuid.UUID, payload: DeadlineUpdate) -> Deadline:
        row = await owned_deadline(self.session, deadline_id, self.user_id)
        previous = row.status
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(row, field, value)
        if previous != DeadlineStatus.DONE and row.status == DeadlineStatus.DONE:
            self.session.add(
                Activity(
                    user_id=self.user_id, type=ActivityType.DEADLINE_COMPLETED, entity_id=row.id
                )
            )
        await self.session.commit()
        await self.session.refresh(row)
        return row

    async def delete_deadline(self, deadline_id: uuid.UUID) -> None:
        row = await owned_deadline(self.session, deadline_id, self.user_id)
        await self.session.delete(row)
        await self.session.commit()

    async def create_event(self, payload: EventCreate) -> CalendarEvent:
        if payload.course_id:
            await owned_course(self.session, payload.course_id, self.user_id)
        row = CalendarEvent(user_id=self.user_id, **payload.model_dump())
        self.session.add(row)
        await self.session.commit()
        await self.session.refresh(row)
        return row

    async def update_event(self, event_id: uuid.UUID, payload: EventCreate) -> CalendarEvent:
        row = await self.session.scalar(
            select(CalendarEvent).where(
                CalendarEvent.id == event_id, CalendarEvent.user_id == self.user_id
            )
        )
        if row is None:
            raise NotFoundError("EVENT_NOT_FOUND", "Calendar event not found")
        for field, value in payload.model_dump().items():
            setattr(row, field, value)
        await self.session.commit()
        await self.session.refresh(row)
        return row

    async def delete_event(self, event_id: uuid.UUID) -> None:
        row = await self.session.scalar(
            select(CalendarEvent).where(
                CalendarEvent.id == event_id, CalendarEvent.user_id == self.user_id
            )
        )
        if row is None:
            raise NotFoundError("EVENT_NOT_FOUND", "Calendar event not found")
        await self.session.delete(row)
        await self.session.commit()
