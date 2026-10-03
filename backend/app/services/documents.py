import re
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.rag import TextSplitter
from app.config import settings
from app.core.exceptions import AppError
from app.core.storage import StorageBackend
from app.models import Activity, ActivityType, Document
from app.repositories.scoped import owned_course, owned_document
from app.services.document_processing import extract_in_child, processing_slot, rejection
from app.services.private_files import ensure_private_writes_enabled

ALLOWED_TYPES = {
    ".pdf": ("application/pdf", b"%PDF"),
    ".docx": ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", b"PK"),
    ".pptx": ("application/vnd.openxmlformats-officedocument.presentationml.presentation", b"PK"),
    ".txt": ("text/plain", None),
}


class DocumentService:
    def __init__(self, session: AsyncSession, user_id: uuid.UUID, storage: StorageBackend):
        self.session = session
        self.user_id = user_id
        self.storage = storage
        self.prepared_pages: list[tuple[int | None, str]] | None = None

    async def upload(self, course_id: uuid.UUID, file: UploadFile) -> Document:
        await owned_course(self.session, course_id, self.user_id)
        ensure_private_writes_enabled()
        async with processing_slot():
            self.prepared_pages = None
            return await self._upload(course_id, file)

    async def _upload(self, course_id: uuid.UUID, file: UploadFile) -> Document:
        original = Path(file.filename or "").name
        extension = Path(original).suffix.lower()
        if extension not in ALLOWED_TYPES:
            raise AppError(
                "UNSUPPORTED_FILE", "Only PDF, DOCX, PPTX, and TXT files are accepted", 415
            )
        content = await file.read(settings.max_upload_bytes + 1)
        if not content:
            raise AppError("EMPTY_FILE", "Uploaded file is empty", 422)
        if len(content) > settings.max_upload_bytes:
            raise AppError("FILE_TOO_LARGE", "Uploaded file exceeds the configured size limit", 413)
        expected_mime, signature = ALLOWED_TYPES[extension]
        if signature and not content.startswith(signature):
            raise AppError(
                "INVALID_FILE_SIGNATURE", "File content does not match its extension", 415
            )
        if extension == ".txt":
            try:
                content.decode("utf-8")
            except UnicodeDecodeError as exc:
                raise AppError(
                    "INVALID_TEXT_ENCODING", "TXT files must use UTF-8 encoding", 415
                ) from exc
        self.prepared_pages = await extract_in_child(content, extension)
        try:
            TextSplitter().split(self.prepared_pages, max_chunks=settings.document_max_chunks)
        except ValueError as exc:
            raise rejection("DOCUMENT_RESOURCE_LIMIT") from exc
        safe_stem = (
            re.sub(r"[^a-zA-Z0-9._-]+", "-", Path(original).stem).strip("-.")[:80] or "document"
        )
        object_id = uuid.uuid4()
        storage_key = f"users/{self.user_id}/courses/{course_id}/{object_id}{extension}"
        await self.storage.upload(storage_key, content, expected_mime)
        document = Document(
            id=object_id,
            user_id=self.user_id,
            course_id=course_id,
            filename=f"{safe_stem}{extension}",
            original_filename=original,
            mime_type=expected_mime,
            size=len(content),
            storage_key=storage_key,
        )
        self.session.add(document)
        self.session.add(
            Activity(user_id=self.user_id, type=ActivityType.DOCUMENT_UPLOADED, entity_id=object_id)
        )
        await self.session.commit()
        await self.session.refresh(document)
        return document

    async def list(
        self, page: int, page_size: int, course_id: uuid.UUID | None
    ) -> tuple[list[Document], int]:
        filters = [Document.user_id == self.user_id]
        if course_id:
            await owned_course(self.session, course_id, self.user_id)
            filters.append(Document.course_id == course_id)
        total = (
            await self.session.scalar(select(func.count()).select_from(Document).where(*filters))
            or 0
        )
        items = list(
            (
                await self.session.scalars(
                    select(Document)
                    .where(*filters)
                    .order_by(Document.created_at.desc())
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).all()
        )
        return items, total

    async def get(self, document_id: uuid.UUID) -> Document:
        return await owned_document(self.session, document_id, self.user_id)

    async def delete(self, document_id: uuid.UUID) -> None:
        document = await self.get(document_id)
        ensure_private_writes_enabled()
        await self.storage.delete(document.storage_key)
        await self.session.delete(document)
        await self.session.commit()
