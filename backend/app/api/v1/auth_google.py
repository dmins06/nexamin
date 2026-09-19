from fastapi import APIRouter

from app.dependencies import DBSession
from app.schemas import GoogleAuthRequest, TokenPair
from app.services.google_auth import GoogleAuthService

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/google", response_model=TokenPair)
async def google_oauth(payload: GoogleAuthRequest, session: DBSession) -> TokenPair:
    return await GoogleAuthService(session).exchange(payload.authorization_code)
