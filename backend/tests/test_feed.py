from app.core.exceptions import ForbiddenError
from app.models import Friendship, FriendshipStatus
from app.schemas.social import SocialPostCreate
from app.services.feed import FeedService


async def test_feed_supports_privacy_reactions_comments_and_reposts(session, users) -> None:
    first, second = users
    first_feed = FeedService(session, first)
    second_feed = FeedService(session, second)

    public = await first_feed.create(
        SocialPostCreate(content="Ghi chú ôn tập hôm nay", visibility="public")
    )
    private = await first_feed.create(
        SocialPostCreate(content="Nhật ký riêng", visibility="private")
    )

    assert [item.id for item in await second_feed.feed()] == [public.id]

    liked = await second_feed.toggle_like(public.id)
    assert liked.liked_by_me is True
    assert liked.like_count == 1

    commented = await second_feed.comment(public.id, "Phần này rất hữu ích")
    assert commented.comment_count == 1
    assert commented.comments[0].author.id == second.id

    reposted = await second_feed.repost(
        public.id,
        SocialPostCreate(content="Chia sẻ lại", visibility="public"),
    )
    assert reposted.repost_of_id == public.id
    assert reposted.repost_of is not None
    assert reposted.repost_of.content == public.content

    try:
        await second_feed.toggle_like(private.id)
    except ForbiddenError:
        pass
    else:
        raise AssertionError("Private posts must not be visible to another user")


async def test_friends_only_post_is_visible_after_acceptance(session, users) -> None:
    first, second = users
    session.add(
        Friendship(
            user_a_id=min(first.id, second.id, key=str),
            user_b_id=max(first.id, second.id, key=str),
            requested_by_id=first.id,
            status=FriendshipStatus.ACCEPTED,
        )
    )
    await session.commit()

    post = await FeedService(session, first).create(
        SocialPostCreate(content="Tài liệu dành cho bạn bè", visibility="friends")
    )

    visible = await FeedService(session, second).feed()
    assert [item.id for item in visible] == [post.id]
