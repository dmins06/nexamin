import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Activity, Course, Deadline, DeadlineStatus, Document, TopicMastery
from app.schemas import DashboardResponse, DeadlineResponse, TopicMasteryResponse


class DashboardService:
    def __init__(self, session: AsyncSession, user_id: uuid.UUID):
        self.session = session
        self.user_id = user_id

    async def get(self) -> DashboardResponse:
        now = datetime.now(UTC)
        week_end = now + timedelta(days=7)
        courses_count = (
            await self.session.scalar(
                select(func.count()).select_from(Course).where(Course.owner_id == self.user_id)
            )
            or 0
        )
        documents_count = (
            await self.session.scalar(
                select(func.count()).select_from(Document).where(Document.user_id == self.user_id)
            )
            or 0
        )
        deadline_filter = (
            Deadline.user_id == self.user_id,
            Deadline.due_at >= now,
            Deadline.due_at <= week_end,
            Deadline.status != DeadlineStatus.DONE,
        )
        upcoming_count = (
            await self.session.scalar(
                select(func.count()).select_from(Deadline).where(*deadline_filter)
            )
            or 0
        )
        deadlines = list(
            (
                await self.session.scalars(
                    select(Deadline).where(*deadline_filter).order_by(Deadline.due_at).limit(5)
                )
            ).all()
        )
        mastery = list(
            (
                await self.session.scalars(
                    select(TopicMastery)
                    .where(TopicMastery.user_id == self.user_id)
                    .order_by(TopicMastery.last_practiced_at.desc())
                    .limit(12)
                )
            ).all()
        )
        activities = list(
            (
                await self.session.scalars(
                    select(Activity)
                    .where(Activity.user_id == self.user_id)
                    .order_by(Activity.created_at.desc())
                    .limit(10)
                )
            ).all()
        )
        weekly_progress = (
            round(sum(row.mastery_score for row in mastery) / len(mastery)) if mastery else 0
        )
        recent: list[dict[str, Any]] = [
            {
                "id": str(row.id),
                "type": row.type.value,
                "entity_id": str(row.entity_id) if row.entity_id else None,
                "metadata": row.activity_metadata,
                "created_at": row.created_at.isoformat(),
            }
            for row in activities
        ]
        return DashboardResponse(
            courses_count=courses_count,
            upcoming_deadlines_count=upcoming_count,
            documents_count=documents_count,
            weekly_progress=weekly_progress,
            upcoming_deadlines=[DeadlineResponse.model_validate(row) for row in deadlines],
            course_progress=[TopicMasteryResponse.model_validate(row) for row in mastery],
            recent_activity=recent,
        )
