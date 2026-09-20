import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.auth import UniversitySummary


class PublicProfile(BaseModel):
    id: uuid.UUID
    full_name: str
    avatar_url: str | None
    university: UniversitySummary | None
    major: str | None
    friendship_id: uuid.UUID | None = None
    friendship_status: str | None = None
    request_incoming: bool = False


class FriendshipResponse(BaseModel):
    id: uuid.UUID
    status: str
    request_incoming: bool
    profile: PublicProfile
    created_at: datetime


class UnreadMessageSummary(BaseModel):
    total: int
    by_sender: dict[str, int]


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class DirectMessageResponse(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    recipient_id: uuid.UUID
    content: str
    created_at: datetime
    read_at: datetime | None
