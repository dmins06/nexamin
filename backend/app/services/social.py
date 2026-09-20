import uuid
from datetime import UTC, datetime
from typing import cast

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import AppError, ForbiddenError, NotFoundError
from app.models import DirectMessage, Friendship, FriendshipStatus, University, User
from app.schemas.auth import UniversitySummary
from app.schemas.social import (
    DirectMessageResponse,
    FriendshipResponse,
    PublicProfile,
    UnreadMessageSummary,
)


class SocialService:
    def __init__(self, session: AsyncSession, user: User):
        self.session = session
        self.user = user

    @staticmethod
    def _pair(first: uuid.UUID, second: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
        return (first, second) if str(first) < str(second) else (second, first)

    async def _friendship(self, other_id: uuid.UUID) -> Friendship | None:
        first, second = self._pair(self.user.id, other_id)
        return cast(
            Friendship | None,
            await self.session.scalar(
                select(Friendship).where(
                    Friendship.user_a_id == first,
                    Friendship.user_b_id == second,
                )
            ),
        )

    async def _user(self, user_id: uuid.UUID) -> User:
        user = await self.session.scalar(
            select(User)
            .options(joinedload(User.university))
            .where(User.id == user_id, User.is_active)
        )
        if user is None:
            raise NotFoundError("USER_NOT_FOUND", "Không tìm thấy người dùng")
        return user

    def _public(self, user: User, friendship: Friendship | None = None) -> PublicProfile:
        university = None
        if user.university is not None:
            university = UniversitySummary(
                id=user.university.id,
                official_code=user.university.official_code,
                name=user.university.name,
                short_name=user.university.short_name,
                logo_url=user.university.logo_url,
            )
        return PublicProfile(
            id=user.id,
            full_name=user.full_name,
            avatar_url=user.avatar_url,
            university=university,
            major=user.major,
            friendship_id=friendship.id if friendship else None,
            friendship_status=friendship.status.value if friendship else None,
            request_incoming=bool(friendship and friendship.requested_by_id != self.user.id),
        )

    async def profile(self, user_id: uuid.UUID) -> PublicProfile:
        user = await self._user(user_id)
        return self._public(user, await self._friendship(user_id))

    async def people(self, query: str, limit: int = 30) -> list[PublicProfile]:
        statement = (
            select(User)
            .outerjoin(University, User.university_id == University.id)
            .options(joinedload(User.university))
            .where(User.id != self.user.id, User.is_active)
            .order_by(User.full_name)
            .limit(limit)
        )
        if query.strip():
            pattern = f"%{query.strip()}%"
            statement = statement.where(
                or_(
                    User.full_name.ilike(pattern),
                    User.major.ilike(pattern),
                    University.name.ilike(pattern),
                    University.short_name.ilike(pattern),
                )
            )
        users = list((await self.session.scalars(statement)).unique().all())
        relationships = list(
            (
                await self.session.scalars(
                    select(Friendship).where(
                        or_(
                            Friendship.user_a_id == self.user.id,
                            Friendship.user_b_id == self.user.id,
                        )
                    )
                )
            ).all()
        )
        relationship_by_user = {
            (item.user_b_id if item.user_a_id == self.user.id else item.user_a_id): item
            for item in relationships
        }
        return [self._public(user, relationship_by_user.get(user.id)) for user in users]

    async def request_friend(self, other_id: uuid.UUID) -> FriendshipResponse:
        if other_id == self.user.id:
            raise AppError("INVALID_FRIEND", "Bạn không thể tự kết bạn")
        other = await self._user(other_id)
        if await self._friendship(other_id):
            raise AppError("FRIENDSHIP_EXISTS", "Yêu cầu kết bạn đã tồn tại", 409)
        first, second = self._pair(self.user.id, other_id)
        friendship = Friendship(
            user_a_id=first,
            user_b_id=second,
            requested_by_id=self.user.id,
            status=FriendshipStatus.PENDING,
        )
        self.session.add(friendship)
        await self.session.commit()
        await self.session.refresh(friendship)
        return self._friendship_response(friendship, other)

    async def list_friendships(self) -> list[FriendshipResponse]:
        rows = list(
            (
                await self.session.scalars(
                    select(Friendship)
                    .where(
                        or_(
                            Friendship.user_a_id == self.user.id,
                            Friendship.user_b_id == self.user.id,
                        )
                    )
                    .order_by(Friendship.updated_at.desc())
                )
            ).all()
        )
        result: list[FriendshipResponse] = []
        for friendship in rows:
            other_id = (
                friendship.user_b_id
                if friendship.user_a_id == self.user.id
                else friendship.user_a_id
            )
            result.append(self._friendship_response(friendship, await self._user(other_id)))
        return result

    def _friendship_response(self, friendship: Friendship, other: User) -> FriendshipResponse:
        incoming = friendship.requested_by_id != self.user.id
        return FriendshipResponse(
            id=friendship.id,
            status=friendship.status.value,
            request_incoming=incoming,
            profile=self._public(other, friendship),
            created_at=friendship.created_at,
        )

    async def accept(self, friendship_id: uuid.UUID) -> FriendshipResponse:
        friendship = await self.session.get(Friendship, friendship_id)
        if friendship is None:
            raise NotFoundError("FRIENDSHIP_NOT_FOUND", "Không tìm thấy lời mời kết bạn")
        if self.user.id not in (friendship.user_a_id, friendship.user_b_id):
            raise ForbiddenError()
        if friendship.requested_by_id == self.user.id:
            raise ForbiddenError(message="Chỉ người nhận mới có thể chấp nhận lời mời")
        friendship.status = FriendshipStatus.ACCEPTED
        await self.session.commit()
        await self.session.refresh(friendship)
        other_id = (
            friendship.user_b_id if friendship.user_a_id == self.user.id else friendship.user_a_id
        )
        return self._friendship_response(friendship, await self._user(other_id))

    async def remove(self, friendship_id: uuid.UUID) -> None:
        friendship = await self.session.get(Friendship, friendship_id)
        if friendship is None:
            raise NotFoundError("FRIENDSHIP_NOT_FOUND", "Không tìm thấy quan hệ bạn bè")
        if self.user.id not in (friendship.user_a_id, friendship.user_b_id):
            raise ForbiddenError()
        await self.session.delete(friendship)
        await self.session.commit()

    async def unread_messages(self) -> UnreadMessageSummary:
        rows = (
            await self.session.execute(
                select(DirectMessage.sender_id, func.count(DirectMessage.id))
                .where(
                    DirectMessage.recipient_id == self.user.id,
                    DirectMessage.read_at.is_(None),
                )
                .group_by(DirectMessage.sender_id)
            )
        ).all()
        counts = {str(sender_id): int(count) for sender_id, count in rows}
        return UnreadMessageSummary(total=sum(counts.values()), by_sender=counts)

    async def messages(self, other_id: uuid.UUID) -> list[DirectMessageResponse]:
        await self._require_friend(other_id)
        rows = list(
            (
                await self.session.scalars(
                    select(DirectMessage)
                    .where(
                        or_(
                            (DirectMessage.sender_id == self.user.id)
                            & (DirectMessage.recipient_id == other_id),
                            (DirectMessage.sender_id == other_id)
                            & (DirectMessage.recipient_id == self.user.id),
                        )
                    )
                    .order_by(DirectMessage.created_at.asc())
                    .limit(300)
                )
            ).all()
        )
        unread = [row for row in rows if row.recipient_id == self.user.id and row.read_at is None]
        if unread:
            read_at = datetime.now(UTC)
            for row in unread:
                row.read_at = read_at
            await self.session.commit()
        return [DirectMessageResponse.model_validate(row, from_attributes=True) for row in rows]

    async def send_message(self, other_id: uuid.UUID, content: str) -> DirectMessageResponse:
        await self._require_friend(other_id)
        message = DirectMessage(
            sender_id=self.user.id, recipient_id=other_id, content=content.strip()
        )
        self.session.add(message)
        await self.session.commit()
        await self.session.refresh(message)
        return DirectMessageResponse.model_validate(message, from_attributes=True)

    async def _require_friend(self, other_id: uuid.UUID) -> Friendship:
        friendship = await self._friendship(other_id)
        if friendship is None or friendship.status != FriendshipStatus.ACCEPTED:
            raise ForbiddenError(message="Chỉ bạn bè mới có thể trò chuyện")
        return friendship
