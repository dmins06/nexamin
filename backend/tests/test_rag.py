from app.ai.rag import TextSplitter


def test_short_document_creates_one_chunk() -> None:
    chunks = TextSplitter(chunk_size=100, overlap=20).split([(1, "Nội dung ngắn")])
    assert chunks == [(1, "Nội dung ngắn")]


def test_long_document_chunks_finish_without_duplicate_tail() -> None:
    text = " ".join(f"word-{index}" for index in range(80))
    chunks = TextSplitter(chunk_size=100, overlap=20).split([(1, text)])
    assert len(chunks) > 1
    assert chunks[-1][1].endswith("word-79")
    assert len({content for _, content in chunks}) == len(chunks)
