from fastapi import APIRouter, status
from pydantic import BaseModel, Field

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
from app.services.password_recovery import reset_password

router = APIRouter(prefix="/auth", tags=["Auth"])


class PasswordResetPayload(BaseModel):
    token: str = Field(min_length=20, max_length=4096)
    new_password: str = Field(min_length=8, max_length=128)


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, session: DBSession) -> TokenPair:
    return await AuthService(session).register(payload)


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


@router.post("/reset-password", response_model=MessageResponse)
async def complete_password_reset(
    payload: PasswordResetPayload, session: DBSession
) -> MessageResponse:
    await reset_password(session, payload.token, payload.new_password)
    return MessageResponse(message="Mật khẩu đã đổi. Hãy đăng nhập lại.")
