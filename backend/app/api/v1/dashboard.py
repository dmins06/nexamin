from fastapi import APIRouter

from app.dependencies import CurrentUser, DBSession
from app.schemas import DashboardResponse
from app.services.dashboard import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardResponse)
async def dashboard(session: DBSession, user: CurrentUser) -> DashboardResponse:
    return await DashboardService(session, user.id).get()
