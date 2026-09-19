import uuid

import pytest

from app.core.exceptions import NotFoundError
from app.models import Conversation, Course, Document
from app.repositories.scoped import owned_conversation, owned_course, owned_document


@pytest.mark.asyncio
async def test_private_resources_are_not_visible_to_another_user(session, users) -> None:
    owner, stranger = users
    course = Course(id=uuid.uuid4(), owner_id=owner.id, name="Private AI")
    document = Document(
        id=uuid.uuid4(),
        user_id=owner.id,
        course_id=course.id,
        filename="private.pdf",
        original_filename="private.pdf",
        mime_type="application/pdf",
        size=10,
        storage_key="private/key",
    )
    conversation = Conversation(
        id=uuid.uuid4(), user_id=owner.id, course_id=course.id, title="Private"
    )
    session.add_all([course, document, conversation])
    await session.commit()
    for operation, resource_id in [
        (owned_course, course.id),
        (owned_document, document.id),
        (owned_conversation, conversation.id),
    ]:
        with pytest.raises(NotFoundError):
            await operation(session, resource_id, stranger.id)
