import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.entities import Role
from app.schemas.common import ORMModel


class UniversitySummary(ORMModel):
    id: uuid.UUID
    official_code: str | None
    name: str
    short_name: str
    logo_url: str | None


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(min_length=2, max_length=150)
    university_id: uuid.UUID | None = None
    major: str | None = Field(default=None, max_length=300)
    student_year: int | None = Field(default=None, ge=1, le=10)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=32)


class GoogleAuthRequest(BaseModel):
    authorization_code: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(ORMModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    avatar_url: str | None
    university_id: uuid.UUID | None
    university: UniversitySummary | None = None
    major: str | None
    student_year: int | None
    bio: str | None
    role: Role
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    university_id: uuid.UUID | None = None
    major: str | None = Field(default=None, max_length=300)
    student_year: int | None = Field(default=None, ge=1, le=10)
    bio: str | None = Field(default=None, max_length=1000)
