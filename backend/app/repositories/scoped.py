import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models import Conversation, Course, Deadline, Document, Quiz


async def owned_course(session: AsyncSession, course_id: uuid.UUID, user_id: uuid.UUID) -> Course:
    course = await session.scalar(
        select(Course).where(Course.id == course_id, Course.owner_id == user_id)
    )
    if course is None:
        raise NotFoundError("COURSE_NOT_FOUND", "Course not found")
    return course


async def owned_document(
    session: AsyncSession, document_id: uuid.UUID, user_id: uuid.UUID
) -> Document:
    document = await session.scalar(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    if document is None:
        raise NotFoundError("DOCUMENT_NOT_FOUND", "Document not found")
    return document


async def owned_conversation(
    session: AsyncSession, conversation_id: uuid.UUID, user_id: uuid.UUID
) -> Conversation:
    conversation = await session.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id, Conversation.user_id == user_id
        )
    )
    if conversation is None:
        raise NotFoundError("CONVERSATION_NOT_FOUND", "Conversation not found")
    return conversation


async def owned_quiz(session: AsyncSession, quiz_id: uuid.UUID, user_id: uuid.UUID) -> Quiz:
    quiz = await session.scalar(select(Quiz).where(Quiz.id == quiz_id, Quiz.user_id == user_id))
    if quiz is None:
        raise NotFoundError("QUIZ_NOT_FOUND", "Quiz not found")
    return quiz


async def owned_deadline(
    session: AsyncSession, deadline_id: uuid.UUID, user_id: uuid.UUID
) -> Deadline:
    deadline = await session.scalar(
        select(Deadline).where(Deadline.id == deadline_id, Deadline.user_id == user_id)
    )
    if deadline is None:
        raise NotFoundError("DEADLINE_NOT_FOUND", "Deadline not found")
    return deadline
