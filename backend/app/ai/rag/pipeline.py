import re
import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Document, DocumentChunk


@dataclass(slots=True)
class RetrievedChunk:
    id: uuid.UUID
    document_id: uuid.UUID
    filename: str
    content: str
    page_number: int | None
    score: float


class TextSplitter:
    def __init__(
        self, chunk_size: int = settings.chunk_size, overlap: int = settings.chunk_overlap
    ):
        if chunk_size <= 0 or overlap < 0 or overlap >= chunk_size:
            raise ValueError("chunk overlap must be smaller than chunk size")
        self.chunk_size = chunk_size
        self.overlap = overlap

    def split(
        self, pages: list[tuple[int | None, str]], *, max_chunks: int | None = None,
    ) -> list[tuple[int | None, str]]:
        chunks: list[tuple[int | None, str]] = []
        for page, text in pages:
            normalized = re.sub(r"\s+", " ", text).strip()
            cursor = 0
            while cursor < len(normalized):
                end = min(cursor + self.chunk_size, len(normalized))
                if end < len(normalized):
                    boundary = normalized.rfind(" ", cursor, end)
                    if boundary > cursor + self.chunk_size // 2:
                        end = boundary
                chunk = normalized[cursor:end].strip()
                if chunk:
                    if max_chunks is not None and len(chunks) >= max_chunks:
                        raise ValueError("Document exceeds maximum chunk count")
                    chunks.append((page, chunk))
                if end >= len(normalized):
                    break
                cursor = max(end - self.overlap, cursor + 1)
        return chunks


class PermissionScopedRetriever:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def retrieve(
        self, *, user_id: uuid.UUID, course_id: uuid.UUID, query_embedding: list[float]
    ) -> list[RetrievedChunk]:
        distance = DocumentChunk.embedding.cosine_distance(query_embedding)
        statement = (
            select(DocumentChunk, Document.filename, distance.label("distance"))
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(
                Document.user_id == user_id,
                Document.course_id == course_id,
                DocumentChunk.course_id == course_id,
            )
            .order_by(distance)
            .limit(settings.rag_top_k)
        )
        rows = (await self.session.execute(statement)).all()
        return [
            RetrievedChunk(
                id=chunk.id,
                document_id=chunk.document_id,
                filename=filename,
                content=chunk.content,
                page_number=chunk.page_number,
                score=max(0.0, 1.0 - float(distance_value)),
            )
            for chunk, filename, distance_value in rows
        ]

    async def retrieve_lexical(
        self, *, user_id: uuid.UUID, course_id: uuid.UUID
    ) -> list[RetrievedChunk]:
        statement = (
            select(DocumentChunk, Document.filename)
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(
                Document.user_id == user_id,
                Document.course_id == course_id,
                DocumentChunk.course_id == course_id,
            )
            .order_by(DocumentChunk.chunk_index)
            .limit(1000)
        )
        rows = (await self.session.execute(statement)).all()
        return [
            RetrievedChunk(
                id=chunk.id,
                document_id=chunk.document_id,
                filename=filename,
                content=chunk.content,
                page_number=chunk.page_number,
                score=0.5,
            )
            for chunk, filename in rows
        ]


class LexicalReranker:
    def rerank(
        self, query: str, chunks: list[RetrievedChunk], limit: int | None = None
    ) -> list[RetrievedChunk]:
        terms = set(re.findall(r"\w+", query.lower()))
        scored = []
        for position, chunk in enumerate(chunks):
            overlap = len(terms.intersection(re.findall(r"\w+", chunk.content.lower())))
            scored.append((chunk.score + min(overlap / 20, 0.25), position, chunk))
        return [
            item[2]
            for item in sorted(scored, key=lambda item: (-item[0], item[1]))[
                : limit or settings.rerank_top_k
            ]
        ]


class ContextBuilder:
    def build(self, chunks: list[RetrievedChunk]) -> str:
        parts: list[str] = []
        used = 0
        char_budget = settings.max_context_tokens * 4
        for index, chunk in enumerate(chunks, start=1):
            header = f"[Nguồn {index}: {chunk.filename}, trang {chunk.page_number or 'không rõ'}]"
            block = f"{header}\n{chunk.content}"
            if used + len(block) > char_budget:
                break
            parts.append(block)
            used += len(block)
        return "\n\n".join(parts)
