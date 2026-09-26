from fastapi import APIRouter

from app.dependencies import CurrentUser, DBSession
from app.schemas.electives import (
    AdvisorAvailability,
    CareerComparison,
    CareerSummary,
    ComparisonRequest,
    CurriculumSummary,
    ElectivePlan,
    RecommendationRequest,
)
from app.services.electives import ElectiveRecommendationService

router = APIRouter(prefix="/electives", tags=["Electives"])


@router.get("/availability", response_model=AdvisorAvailability)
async def availability(session: DBSession, user: CurrentUser) -> AdvisorAvailability:
    return ElectiveRecommendationService(session, user).availability()


@router.get("/curricula", response_model=list[CurriculumSummary])
async def curricula(session: DBSession, user: CurrentUser) -> list[CurriculumSummary]:
    return await ElectiveRecommendationService(session, user).curricula()


@router.get("/careers", response_model=list[CareerSummary])
async def careers(session: DBSession, user: CurrentUser) -> list[CareerSummary]:
    return ElectiveRecommendationService(session, user).career_paths()


@router.post("/recommend", response_model=ElectivePlan)
async def recommend(
    payload: RecommendationRequest, session: DBSession, user: CurrentUser
) -> ElectivePlan:
    return await ElectiveRecommendationService(session, user).recommend(
        payload.curriculum_id, payload.career_code
    )


@router.post("/compare", response_model=CareerComparison)
async def compare(
    payload: ComparisonRequest, session: DBSession, user: CurrentUser
) -> CareerComparison:
    return await ElectiveRecommendationService(session, user).compare(
        payload.curriculum_id, payload.first_career_code, payload.second_career_code
    )
