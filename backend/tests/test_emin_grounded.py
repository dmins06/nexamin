import uuid

import pytest

from app.ai.providers.local import EminLocalProvider
from app.ai.rag import LexicalReranker
from app.ai.rag.pipeline import RetrievedChunk


@pytest.mark.asyncio
async def test_local_emin_summarizes_document_with_citations() -> None:
    prompt = """Ngữ cảnh:
[Nguồn 1: lecture.pdf, trang 2]
Quang hợp chuyển đổi năng lượng ánh sáng thành năng lượng hóa học. Quá trình này diễn ra trong lục lạp của tế bào thực vật.

[Nguồn 2: lecture.pdf, trang 3]
Pha sáng tạo ATP và NADPH. Chu trình Calvin sử dụng các sản phẩm này để cố định carbon dioxide.

Câu hỏi của sinh viên:
Hãy tóm tắt nội dung tài liệu."""

    answer = await EminLocalProvider().generate(prompt)

    assert "### Tóm tắt tài liệu" in answer
    assert "Quang hợp" in answer
    assert "[Nguồn 1]" in answer
    assert "Mình đã nhận câu hỏi" not in answer


def test_lexical_reranker_handles_equal_scores_deterministically() -> None:
    chunks = [
        RetrievedChunk(uuid.uuid4(), uuid.uuid4(), "a.txt", "nội dung chung", None, 0.5),
        RetrievedChunk(uuid.uuid4(), uuid.uuid4(), "b.txt", "nội dung chung", None, 0.5),
    ]

    result = LexicalReranker().rerank("không trùng", chunks, limit=2)

    assert [item.filename for item in result] == ["a.txt", "b.txt"]
