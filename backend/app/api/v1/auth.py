from fastapi import APIRouter, status

from app.config import settings
from app.dependencies import CurrentUser, DBSession
from app.schemas import (
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegistrationChallengeResponse,
    RegistrationVerifyRequest,
    TokenPair,
    UserCreate,
    UserResponse,
)
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["Auth"])


def _mask_email(email: str) -> str:
    local, domain = email.split("@", 1)
    shown = local[:2] if len(local) > 2 else local[:1]
    return f"{shown}{'*' * max(2, len(local) - len(shown))}@{domain}"


@router.post(
    "/register",
    response_model=TokenPair,
    status_code=status.HTTP_201_CREATED,
)
async def register(payload: UserCreate, session: DBSession) -> TokenPair:
    return await AuthService(session).register_user(payload)


@router.post(
    "/register/resend",
    response_model=RegistrationChallengeResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def resend_registration(payload: UserCreate, session: DBSession) -> RegistrationChallengeResponse:
    challenge, _ = await AuthService(session).resend_registration(payload)
    return RegistrationChallengeResponse(
        challenge_id=challenge.id,
        masked_email=_mask_email(challenge.email),
        expires_in=settings.registration_otp_expire_minutes * 60,
    )


@router.post(
    "/register/verify",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def verify_registration(
    payload: RegistrationVerifyRequest, session: DBSession
) -> UserResponse:
    user = await AuthService(session).verify_registration(payload.challenge_id, payload.otp)
    return UserResponse.model_validate(user)


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
