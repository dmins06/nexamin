import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Activity, ActivityType, Course, CourseTopic
from app.repositories.scoped import owned_course
from app.schemas import CourseCreate, CourseUpdate, TopicCreate


class CourseService:
    def __init__(self, session: AsyncSession, user_id: uuid.UUID):
        self.session = session
        self.user_id = user_id

    async def create(self, payload: CourseCreate) -> Course:
        course = Course(owner_id=self.user_id, **payload.model_dump())
        self.session.add(course)
        await self.session.flush()
        self.session.add(
            Activity(user_id=self.user_id, type=ActivityType.COURSE_CREATED, entity_id=course.id)
        )
        await self.session.commit()
        await self.session.refresh(course)
        return course

    async def list(self, page: int, page_size: int) -> tuple[list[Course], int]:
        where = Course.owner_id == self.user_id
        total = (
            await self.session.scalar(select(func.count()).select_from(Course).where(where)) or 0
        )
        items = list(
            (
                await self.session.scalars(
                    select(Course)
                    .where(where)
                    .order_by(Course.created_at.desc())
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).all()
        )
        return items, total

    async def get(self, course_id: uuid.UUID) -> Course:
        return await owned_course(self.session, course_id, self.user_id)

    async def update(self, course_id: uuid.UUID, payload: CourseUpdate) -> Course:
        course = await self.get(course_id)
        changes = payload.model_dump(exclude_unset=True)
        if "is_completed" in changes:
            course.completed_at = datetime.now(UTC) if changes["is_completed"] else None
        for field, value in changes.items():
            setattr(course, field, value)
        await self.session.commit()
        await self.session.refresh(course)
        return course

    async def delete(self, course_id: uuid.UUID) -> None:
        course = await self.get(course_id)
        await self.session.delete(course)
        await self.session.commit()

    async def create_topic(self, course_id: uuid.UUID, payload: TopicCreate) -> CourseTopic:
        await self.get(course_id)
        topic = CourseTopic(course_id=course_id, **payload.model_dump())
        self.session.add(topic)
        await self.session.commit()
        await self.session.refresh(topic)
        return topic

    async def list_topics(self, course_id: uuid.UUID) -> tuple[CourseTopic, ...]:
        await self.get(course_id)
        return tuple(
            (
                await self.session.scalars(
                    select(CourseTopic)
                    .where(CourseTopic.course_id == course_id)
                    .order_by(CourseTopic.order_index)
                )
            ).all()
        )
