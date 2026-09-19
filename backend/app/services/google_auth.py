import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import AppError
from app.models import User
from app.schemas import TokenPair
from app.services.auth import AuthService


class GoogleAuthService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def exchange(self, authorization_code: str) -> TokenPair:
        if not settings.google_client_id or not settings.google_client_secret:
            raise AppError("GOOGLE_OAUTH_DISABLED", "Google OAuth is not configured", 503)
        async with httpx.AsyncClient(timeout=20) as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": authorization_code,
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "redirect_uri": settings.google_redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            if token_response.is_error:
                raise AppError("GOOGLE_OAUTH_FAILED", "Google authorization failed", 401)
            access_token = token_response.json().get("access_token")
            user_response = await client.get(
                "https://openidconnect.googleapis.com/v1/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
        if user_response.is_error:
            raise AppError("GOOGLE_OAUTH_FAILED", "Unable to read Google profile", 401)
        profile = user_response.json()
        if not profile.get("email_verified"):
            raise AppError("GOOGLE_EMAIL_UNVERIFIED", "Google email is not verified", 403)
        email = str(profile["email"]).lower()
        user = await self.session.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(
                email=email,
                password_hash=None,
                full_name=str(profile.get("name") or email.split("@", 1)[0]),
                avatar_url=profile.get("picture"),
                is_verified=True,
            )
            self.session.add(user)
            await self.session.flush()
        return await AuthService(self.session)._issue_pair(user)
