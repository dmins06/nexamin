from pydantic import BaseModel

from app.schemas.auth import UserResponse


class StudyStatistics(BaseModel):
    courses_count: int
    documents_count: int
    quizzes_completed: int
    average_mastery: float


class ProfileResponse(UserResponse):
    study_statistics: StudyStatistics
