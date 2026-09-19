import uuid

from fastapi import APIRouter, Query, Response, status
from sqlalchemy import func, select

from app.dependencies import CurrentUser, DBSession
from app.models import Conversation, Message, MessageRole
from app.repositories.scoped import owned_conversation, owned_course
from app.schemas import ConversationCreate, ConversationResponse, Page

router = APIRouter(prefix="/conversations", tags=["AI Tutor"])


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    payload: ConversationCreate, session: DBSession, user: CurrentUser
) -> ConversationResponse:
    await owned_course(session, payload.course_id, user.id)
    row = Conversation(user_id=user.id, **payload.model_dump())
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return ConversationResponse.model_validate(row)


@router.get("", response_model=Page[ConversationResponse])
async def list_conversations(
    session: DBSession,
    user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Page[ConversationResponse]:
    where = Conversation.user_id == user.id
    total = await session.scalar(select(func.count()).select_from(Conversation).where(where)) or 0
    rows = list(
        (
            await session.scalars(
                select(Conversation)
                .where(where)
                .order_by(Conversation.updated_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()
    )
    return Page(
        items=[ConversationResponse.model_validate(row) for row in rows],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> ConversationResponse:
    return ConversationResponse.model_validate(
        await owned_conversation(session, conversation_id, user.id)
    )


@router.post("/{conversation_id}/messages", status_code=status.HTTP_201_CREATED)
async def add_message(
    conversation_id: uuid.UUID, content: str, session: DBSession, user: CurrentUser
) -> dict[str, str]:
    conversation = await owned_conversation(session, conversation_id, user.id)
    row = Message(conversation_id=conversation.id, role=MessageRole.USER, content=content)
    session.add(row)
    await session.commit()
    return {"id": str(row.id), "content": row.content}


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: uuid.UUID, session: DBSession, user: CurrentUser
) -> Response:
    row = await owned_conversation(session, conversation_id, user.id)
    await session.delete(row)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
