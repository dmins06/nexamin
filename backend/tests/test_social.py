from app.services.social import SocialService


async def test_friend_request_acceptance_messaging_and_unread_state(session, users) -> None:
    first, second = users

    request = await SocialService(session, first).request_friend(second.id)
    assert request.status == "pending"
    assert request.request_incoming is False

    accepted = await SocialService(session, second).accept(request.id)
    assert accepted.status == "accepted"
    assert accepted.request_incoming is True

    sent = await SocialService(session, first).send_message(second.id, "Chào bạn!")
    assert sent.content == "Chào bạn!"
    unread = await SocialService(session, second).unread_messages()
    assert unread.total == 1
    assert unread.by_sender == {str(first.id): 1}

    messages = await SocialService(session, second).messages(first.id)
    assert [message.content for message in messages] == ["Chào bạn!"]
    assert messages[0].read_at is not None
    assert (await SocialService(session, second).unread_messages()).total == 0


async def test_public_profile_does_not_expose_private_fields(session, users) -> None:
    first, second = users
    profile = await SocialService(session, first).profile(second.id)

    assert profile.full_name == second.full_name
    assert "email" not in profile.model_dump()
