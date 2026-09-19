import uuid

import pytest
from fastapi import UploadFile

from app.core.exceptions import AppError
from app.models import Course
from app.services.documents import DocumentService


class MemoryStorage:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    async def upload(self, key: str, content: bytes, content_type: str) -> None:
        self.objects[key] = content

    async def delete(self, key: str) -> None:
        self.objects.pop(key, None)


@pytest.mark.asyncio
async def test_invalid_pdf_signature_is_rejected(session, users) -> None:
    owner, _ = users
    course = Course(id=uuid.uuid4(), owner_id=owner.id, name="Security")
    session.add(course)
    await session.commit()
    upload = UploadFile(filename="notes.pdf", file=__import__("io").BytesIO(b"not a pdf"))
    with pytest.raises(AppError) as error:
        await DocumentService(session, owner.id, MemoryStorage()).upload(course.id, upload)
    assert error.value.code == "INVALID_FILE_SIGNATURE"


@pytest.mark.asyncio
async def test_path_traversal_filename_is_normalized(session, users) -> None:
    owner, _ = users
    course = Course(id=uuid.uuid4(), owner_id=owner.id, name="Files")
    session.add(course)
    await session.commit()
    storage = MemoryStorage()
    upload = UploadFile(filename="../../secret.txt", file=__import__("io").BytesIO(b"safe text"))
    document = await DocumentService(session, owner.id, storage).upload(course.id, upload)
    assert ".." not in document.filename
    assert str(owner.id) in document.storage_key
