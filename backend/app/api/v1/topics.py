import uuid

from fastapi import APIRouter, Response, status

from app.dependencies import CurrentUser, DBSession
from app.schemas import TopicResponse
from app.schemas.topics import TopicUpdate
from app.services.topics import TopicService

router = APIRouter(prefix="/courses/{course_id}/topics", tags=["Courses"])


@router.get("/{topic_id}", response_model=TopicResponse)
async def get_topic(
    course_id: uuid.UUID,
    topic_id: uuid.UUID,
    session: DBSession,
    user: CurrentUser,
) -> TopicResponse:
    return TopicResponse.model_validate(
        await TopicService(session, user.id).get(course_id, topic_id)
    )


@router.patch("/{topic_id}", response_model=TopicResponse)
async def update_topic(
    course_id: uuid.UUID,
    topic_id: uuid.UUID,
    payload: TopicUpdate,
    session: DBSession,
    user: CurrentUser,
) -> TopicResponse:
    return TopicResponse.model_validate(
        await TopicService(session, user.id).update(course_id, topic_id, payload)
    )


@router.delete("/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_topic(
    course_id: uuid.UUID,
    topic_id: uuid.UUID,
    session: DBSession,
    user: CurrentUser,
) -> Response:
    await TopicService(session, user.id).delete(course_id, topic_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
