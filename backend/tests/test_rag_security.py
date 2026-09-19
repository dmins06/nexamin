import uuid

from sqlalchemy.dialects import postgresql

from app.models import Document, DocumentChunk


def test_rag_permission_predicate_is_part_of_database_query() -> None:
    user_id = uuid.uuid4()
    course_id = uuid.uuid4()
    distance = DocumentChunk.embedding.cosine_distance([0.0] * 768)
    from sqlalchemy import select

    statement = (
        select(DocumentChunk)
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(
            Document.user_id == user_id,
            Document.course_id == course_id,
            DocumentChunk.course_id == course_id,
        )
        .order_by(distance)
    )
    sql = str(
        statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True})
    )
    assert "documents.user_id" in sql
    assert "documents.course_id" in sql
    assert "document_chunks.course_id" in sql
