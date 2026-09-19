from fastapi import APIRouter, status

from app.dependencies import CurrentUser, DBSession
from app.schemas import (
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    TokenPair,
    UserCreate,
    UserResponse,
)
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, session: DBSession) -> UserResponse:
    return UserResponse.model_validate(await AuthService(session).register(payload))


@router.post("/login", response_model=TokenPair)
async def login(payload: LoginRequest, session: DBSession) -> TokenPair:
    return await AuthService(session).login(payload)


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, session: DBSession) -> TokenPair:
    return await AuthService(session).refresh(payload.refresh_token)


@router.post("/logout", response_model=MessageResponse)
async def logout(payload: RefreshRequest, session: DBSession) -> MessageResponse:
    await AuthService(session).logout(payload.refresh_token)
    return MessageResponse(message="Logged out")


@router.get("/me", response_model=UserResponse)
async def me(user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(user)
