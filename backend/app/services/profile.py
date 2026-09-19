from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.models import Course, Document, QuizAttempt, TopicMastery, User
from app.schemas.auth import UserResponse
from app.schemas.profile import ProfileResponse, StudyStatistics


class ProfileService:
    def __init__(self, session: AsyncSession, user: User):
        self.session = session
        self.user = user

    async def get(self) -> ProfileResponse:
        user_id = self.user.id
        courses = await self._count(Course, Course.owner_id == user_id)
        documents = await self._count(Document, Document.user_id == user_id)
        attempts = await self._count(
            QuizAttempt,
            QuizAttempt.user_id == user_id,
            QuizAttempt.completed_at.is_not(None),
        )
        average = await self.session.scalar(
            select(func.avg(TopicMastery.mastery_score)).where(TopicMastery.user_id == user_id)
        )
        payload = UserResponse.model_validate(self.user).model_dump()
        payload["study_statistics"] = StudyStatistics(
            courses_count=courses,
            documents_count=documents,
            quizzes_completed=attempts,
            average_mastery=round(float(average or 0), 2),
        )
        return ProfileResponse.model_validate(payload)

    async def _count(self, model: type[object], *conditions: ColumnElement[bool]) -> int:
        value = await self.session.scalar(
            select(func.count()).select_from(model).where(*conditions)
        )
        return int(value or 0)
