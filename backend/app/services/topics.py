import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models import CourseTopic
from app.repositories.scoped import owned_course
from app.schemas.topics import TopicUpdate


class TopicService:
    def __init__(self, session: AsyncSession, user_id: uuid.UUID):
        self.session = session
        self.user_id = user_id

    async def get(self, course_id: uuid.UUID, topic_id: uuid.UUID) -> CourseTopic:
        await owned_course(self.session, course_id, self.user_id)
        topic = await self.session.scalar(
            select(CourseTopic).where(
                CourseTopic.id == topic_id,
                CourseTopic.course_id == course_id,
            )
        )
        if topic is None:
            raise NotFoundError("TOPIC_NOT_FOUND", "Course topic not found")
        return topic

    async def update(
        self,
        course_id: uuid.UUID,
        topic_id: uuid.UUID,
        payload: TopicUpdate,
    ) -> CourseTopic:
        topic = await self.get(course_id, topic_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(topic, field, value)
        await self.session.commit()
        await self.session.refresh(topic)
        return topic

    async def delete(self, course_id: uuid.UUID, topic_id: uuid.UUID) -> None:
        topic = await self.get(course_id, topic_id)
        await self.session.delete(topic)
        await self.session.commit()
