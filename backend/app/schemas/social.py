import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.auth import UniversitySummary


class PublicProfile(BaseModel):
    id: uuid.UUID
    full_name: str
    is_admin: bool = False
    avatar_url: str | None
    university: UniversitySummary | None
    major: str | None
    student_year: int | None = None
    bio: str | None = None
    friendship_id: uuid.UUID | None = None
    friendship_status: str | None = None
    request_incoming: bool = False
    is_online: bool = False
    last_seen_at: datetime | None = None


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


class MessageAttachmentResponse(BaseModel):
    url: str
    name: str
    mime_type: str


class DirectMessageResponse(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    recipient_id: uuid.UUID
    content: str
    created_at: datetime
    read_at: datetime | None


class SocialPostCreate(BaseModel):
    content: str = Field(default="", max_length=2000)
    image_url: str | None = Field(default=None, max_length=1000)
    visibility: str = Field(default="public", pattern="^(public|friends|private)$")


class SocialCommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=1000)


class SocialCommentResponse(BaseModel):
    id: uuid.UUID
    author: PublicProfile
    content: str
    created_at: datetime


class SocialPostPreview(BaseModel):
    id: uuid.UUID
    author: PublicProfile
    content: str
    image_url: str | None
    created_at: datetime


class SocialPostResponse(BaseModel):
    id: uuid.UUID
    author: PublicProfile
    content: str
    image_url: str | None
    visibility: str
    repost_of_id: uuid.UUID | None
    repost_of: SocialPostPreview | None
    like_count: int
    comment_count: int
    repost_count: int
    liked_by_me: bool
    comments: list[SocialCommentResponse]
    created_at: datetime
    updated_at: datetime
