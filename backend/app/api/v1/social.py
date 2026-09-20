import uuid

from fastapi import APIRouter, Query, Response, status

from app.dependencies import CurrentUser, DBSession
from app.schemas.social import (
    DirectMessageResponse,
    FriendshipResponse,
    MessageCreate,
    PublicProfile,
    UnreadMessageSummary,
)
from app.services.social import SocialService

router = APIRouter(prefix="/social", tags=["Social"])


@router.get("/people", response_model=list[PublicProfile])
async def find_people(
    session: DBSession,
    user: CurrentUser,
    q: str = Query(default="", max_length=120),
) -> list[PublicProfile]:
    return await SocialService(session, user).people(q)


@router.get("/profiles/{user_id}", response_model=PublicProfile)
async def public_profile(
    user_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> PublicProfile:
    return await SocialService(session, user).profile(user_id)


@router.get("/friendships", response_model=list[FriendshipResponse])
async def friendships(session: DBSession, user: CurrentUser) -> list[FriendshipResponse]:
    return await SocialService(session, user).list_friendships()


@router.post(
    "/friendships/{user_id}",
    response_model=FriendshipResponse,
    status_code=status.HTTP_201_CREATED,
)
async def request_friend(
    user_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> FriendshipResponse:
    return await SocialService(session, user).request_friend(user_id)


@router.post("/friendships/{friendship_id}/accept", response_model=FriendshipResponse)
async def accept_friend(
    friendship_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> FriendshipResponse:
    return await SocialService(session, user).accept(friendship_id)


@router.delete("/friendships/{friendship_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_friend(
    friendship_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> Response:
    await SocialService(session, user).remove(friendship_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/messages/unread", response_model=UnreadMessageSummary)
async def unread_messages(session: DBSession, user: CurrentUser) -> UnreadMessageSummary:
    return await SocialService(session, user).unread_messages()


@router.get("/messages/{user_id}", response_model=list[DirectMessageResponse])
async def messages(
    user_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> list[DirectMessageResponse]:
    return await SocialService(session, user).messages(user_id)


@router.post(
    "/messages/{user_id}",
    response_model=DirectMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    user_id: uuid.UUID,
    payload: MessageCreate,
    session: DBSession,
    user: CurrentUser,
) -> DirectMessageResponse:
    return await SocialService(session, user).send_message(user_id, payload.content)
