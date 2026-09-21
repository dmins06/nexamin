import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from pwdlib import PasswordHash

from app.config import settings
from app.core.exceptions import AppError

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return password_hash.verify(password, hashed)


def create_access_token(user_id: uuid.UUID, role: str) -> tuple[str, int]:
    expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now + expires_delta,
        "jti": secrets.token_hex(16),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, int(expires_delta.total_seconds())


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise AppError("TOKEN_EXPIRED", "Access token has expired", 401) from exc
    except jwt.PyJWTError as exc:
        raise AppError("INVALID_TOKEN", "Invalid access token", 401) from exc
    if payload.get("type") != "access" or not payload.get("sub"):
        raise AppError("INVALID_TOKEN", "Invalid access token", 401)
    return payload


def new_registration_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_registration_otp(challenge_id: uuid.UUID, code: str) -> str:
    message = f"{challenge_id}:{code}".encode()
    return hmac.new(settings.jwt_secret.encode(), message, hashlib.sha256).hexdigest()


def verify_registration_otp(challenge_id: uuid.UUID, code: str, expected: str) -> bool:
    return secrets.compare_digest(hash_registration_otp(challenge_id, code), expected)


def new_refresh_token() -> tuple[str, str]:
    token = secrets.token_urlsafe(48)
    return token, hash_refresh_token(token)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
