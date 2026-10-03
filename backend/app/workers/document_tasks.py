import asyncio
import uuid
from pathlib import Path

from sqlalchemy import delete

from app.ai.rag import TextSplitter
from app.config import settings
from app.core.exceptions import AppError
from app.core.storage import selected_storage
from app.database import SessionFactory
from app.models import Document, DocumentChunk, ProcessingStatus
from app.services.document_processing import extract_in_child, processing_slot, rejection
from app.workers.celery_app import celery_app
from app.workers.document_parser import extract_pages as extract_pages


async def process_document(
    document_id: uuid.UUID, *, prepared_pages: list[tuple[int | None, str]] | None = None,
) -> None:
    async with SessionFactory() as session:
        document = await session.get(Document, document_id)
        if document is None:
            return
        document.processing_status = ProcessingStatus.PROCESSING
        document.processing_error = None
        await session.commit()
        try:
            if prepared_pages is None:
                async with processing_slot():
                    content = await selected_storage().download(document.storage_key)
                    pages = await extract_in_child(content, Path(document.filename).suffix.lower())
            else:
                pages = prepared_pages
            try:
                pieces = TextSplitter().split(pages, max_chunks=settings.document_max_chunks)
            except ValueError as exc:
                raise rejection("DOCUMENT_RESOURCE_LIMIT") from exc
            embeddings = [[0.0] * settings.embedding_dimensions for _ in pieces]
            await session.execute(
                delete(DocumentChunk).where(DocumentChunk.document_id == document.id)
            )
            for index, ((page_number, text), embedding) in enumerate(
                zip(pieces, embeddings, strict=True)
            ):
                session.add(
                    DocumentChunk(
                        document_id=document.id,
                        course_id=document.course_id,
                        content=text,
                        page_number=page_number,
                        chunk_index=index,
                        embedding=embedding,
                        chunk_metadata={
                            "source": document.original_filename,
                            "embedding_provider": "local",
                        },
                    )
                )
            document.page_count = len(pages)
            document.processing_status = ProcessingStatus.READY
            await session.commit()
        except Exception as exc:
            await session.rollback()
            failed = await session.get(Document, document_id)
            if failed is not None:
                failed.processing_status = ProcessingStatus.FAILED
                failed.processing_error = (
                    exc.message if isinstance(exc, AppError)
                    else "Không thể xử lý tài liệu. Vui lòng thử lại hoặc tải file khác."
                )
                await session.commit()
            raise


@celery_app.task(  # type: ignore[untyped-decorator]
    name="documents.process",
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def process_document_task(document_id: str) -> None:
    asyncio.run(process_document(uuid.UUID(document_id)))
