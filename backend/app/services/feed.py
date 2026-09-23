import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import AppError, ForbiddenError, NotFoundError
from app.models import (
    Friendship,
    FriendshipStatus,
    SocialComment,
    SocialPost,
    SocialPostLike,
    SocialPostVisibility,
    User,
)
from app.schemas.social import (
    PublicProfile,
    SocialCommentResponse,
    SocialPostCreate,
    SocialPostPreview,
    SocialPostResponse,
)
from app.services.social import SocialService


class FeedService:
    def __init__(self, session: AsyncSession, user: User):
        self.session = session
        self.user = user
        self.social = SocialService(session, user)

    async def _friend_ids(self) -> set[uuid.UUID]:
        rows = list(
            (
                await self.session.scalars(
                    select(Friendship).where(
                        Friendship.status == FriendshipStatus.ACCEPTED,
                        or_(
                            Friendship.user_a_id == self.user.id,
                            Friendship.user_b_id == self.user.id,
                        ),
                    )
                )
            ).all()
        )
        return {row.user_b_id if row.user_a_id == self.user.id else row.user_a_id for row in rows}

    async def _can_view(self, post: SocialPost) -> bool:
        if post.author_id == self.user.id or post.visibility == SocialPostVisibility.PUBLIC:
            return True
        if post.visibility != SocialPostVisibility.FRIENDS:
            return False
        return post.author_id in await self._friend_ids()

    async def _get_visible(self, post_id: uuid.UUID) -> SocialPost:
        post = await self.session.get(SocialPost, post_id)
        if post is None:
            raise NotFoundError("POST_NOT_FOUND", "Không tìm thấy bài viết")
        if not await self._can_view(post):
            raise ForbiddenError(message="Bạn không có quyền xem bài viết này")
        return post

    async def _author_profile(self, user_id: uuid.UUID) -> PublicProfile:
        author = await self.session.scalar(
            select(User).options(joinedload(User.university)).where(User.id == user_id)
        )
        if author is None:
            raise NotFoundError("USER_NOT_FOUND", "Không tìm thấy người dùng")
        return self.social._public(author, await self.social._friendship(user_id))

    async def _preview(self, post: SocialPost) -> SocialPostPreview:
        return SocialPostPreview(
            id=post.id,
            author=await self._author_profile(post.author_id),
            content=post.content,
            image_url=post.image_url,
            created_at=post.created_at,
        )

    async def _response(self, post: SocialPost) -> SocialPostResponse:
        like_count = int(
            await self.session.scalar(
                select(func.count(SocialPostLike.id)).where(SocialPostLike.post_id == post.id)
            )
            or 0
        )
        repost_count = int(
            await self.session.scalar(
                select(func.count(SocialPost.id)).where(SocialPost.repost_of_id == post.id)
            )
            or 0
        )
        liked_by_me = (
            await self.session.scalar(
                select(SocialPostLike.id).where(
                    SocialPostLike.post_id == post.id,
                    SocialPostLike.user_id == self.user.id,
                )
            )
            is not None
        )
        comment_rows = list(
            (
                await self.session.scalars(
                    select(SocialComment)
                    .where(SocialComment.post_id == post.id)
                    .order_by(SocialComment.created_at.asc())
                    .limit(50)
                )
            ).all()
        )
        comments = [
            SocialCommentResponse(
                id=comment.id,
                author=await self._author_profile(comment.author_id),
                content=comment.content,
                created_at=comment.created_at,
            )
            for comment in comment_rows
        ]
        repost_of = None
        if post.repost_of_id is not None:
            original = await self.session.get(SocialPost, post.repost_of_id)
            if original is not None and await self._can_view(original):
                repost_of = await self._preview(original)
        return SocialPostResponse(
            id=post.id,
            author=await self._author_profile(post.author_id),
            content=post.content,
            image_url=post.image_url,
            visibility=post.visibility.value,
            repost_of_id=post.repost_of_id,
            repost_of=repost_of,
            like_count=like_count,
            comment_count=len(comments),
            repost_count=repost_count,
            liked_by_me=liked_by_me,
            comments=comments,
            created_at=post.created_at,
            updated_at=post.updated_at,
        )

    async def feed(
        self, *, profile_id: uuid.UUID | None = None, limit: int = 40
    ) -> list[SocialPostResponse]:
        friend_ids = await self._friend_ids()
        visibility = or_(
            SocialPost.author_id == self.user.id,
            SocialPost.visibility == SocialPostVisibility.PUBLIC,
            (
                (SocialPost.visibility == SocialPostVisibility.FRIENDS)
                & SocialPost.author_id.in_(friend_ids)
            ),
        )
        statement = (
            select(SocialPost).where(visibility).order_by(SocialPost.created_at.desc()).limit(limit)
        )
        if profile_id is not None:
            statement = statement.where(SocialPost.author_id == profile_id)
        posts = list((await self.session.scalars(statement)).all())
        return [await self._response(post) for post in posts]

    async def create(self, payload: SocialPostCreate) -> SocialPostResponse:
        content = payload.content.strip()
        if not content and not payload.image_url:
            raise AppError("EMPTY_POST", "Hãy viết nội dung hoặc chọn một ảnh")
        post = SocialPost(
            author_id=self.user.id,
            content=content,
            image_url=payload.image_url,
            visibility=SocialPostVisibility(payload.visibility),
        )
        self.session.add(post)
        await self.session.commit()
        await self.session.refresh(post)
        return await self._response(post)

    async def delete(self, post_id: uuid.UUID) -> None:
        post = await self.session.get(SocialPost, post_id)
        if post is None:
            raise NotFoundError("POST_NOT_FOUND", "Không tìm thấy bài viết")
        if post.author_id != self.user.id:
            raise ForbiddenError(message="Bạn chỉ có thể xóa bài viết của mình")
        await self.session.delete(post)
        await self.session.commit()

    async def toggle_like(self, post_id: uuid.UUID) -> SocialPostResponse:
        post = await self._get_visible(post_id)
        existing = await self.session.scalar(
            select(SocialPostLike).where(
                SocialPostLike.post_id == post.id,
                SocialPostLike.user_id == self.user.id,
            )
        )
        if existing is None:
            self.session.add(SocialPostLike(post_id=post.id, user_id=self.user.id))
        else:
            await self.session.delete(existing)
        await self.session.commit()
        return await self._response(post)

    async def comment(self, post_id: uuid.UUID, content: str) -> SocialPostResponse:
        post = await self._get_visible(post_id)
        self.session.add(
            SocialComment(
                post_id=post.id,
                author_id=self.user.id,
                content=content.strip(),
            )
        )
        await self.session.commit()
        return await self._response(post)

    async def repost(self, post_id: uuid.UUID, payload: SocialPostCreate) -> SocialPostResponse:
        original = await self._get_visible(post_id)
        visibility = SocialPostVisibility(payload.visibility)
        if (
            original.visibility == SocialPostVisibility.PRIVATE
            and original.author_id != self.user.id
        ):
            raise ForbiddenError(message="Không thể đăng lại bài viết riêng tư")
        if original.visibility == SocialPostVisibility.FRIENDS:
            visibility = SocialPostVisibility.FRIENDS
        if original.visibility == SocialPostVisibility.PRIVATE:
            visibility = SocialPostVisibility.PRIVATE
        repost = SocialPost(
            author_id=self.user.id,
            content=payload.content.strip(),
            visibility=visibility,
            repost_of_id=original.id,
        )
        self.session.add(repost)
        await self.session.commit()
        await self.session.refresh(repost)
        return await self._response(repost)
