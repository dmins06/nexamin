from fastapi import APIRouter

from app.api.v1 import (
    ai,
    auth,
    auth_google,
    conversations,
    courses,
    dashboard,
    documents,
    planning,
    quizzes,
    social,
    topics,
    universities,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(auth_google.router)
api_router.include_router(users.router)
api_router.include_router(universities.router)
api_router.include_router(courses.router)
api_router.include_router(topics.router)
api_router.include_router(documents.router)
api_router.include_router(ai.router)
api_router.include_router(conversations.router)
api_router.include_router(quizzes.router)
api_router.include_router(social.router)
api_router.include_router(planning.progress_router)
api_router.include_router(planning.deadline_router)
api_router.include_router(planning.calendar_router)
api_router.include_router(dashboard.router)
