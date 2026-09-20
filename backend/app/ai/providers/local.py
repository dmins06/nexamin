import re
from collections.abc import AsyncIterator
from typing import TypeVar

from pydantic import BaseModel

from app.ai.providers.base import LLMProvider
from app.core.exceptions import AppError

T = TypeVar("T", bound=BaseModel)

_SOURCE_PATTERN = re.compile(
    r"\[Nguồn (?P<number>\d+): (?P<label>[^\]]+)\]\n(?P<text>.*?)(?=\n\n\[Nguồn |\Z)",
    re.DOTALL,
)
_SENTENCE_PATTERN = re.compile(r"(?<=[.!?。])\s+|\n+")
_SUMMARY_TERMS = ("tóm tắt", "tom tat", "tổng quan", "tong quan", "ý chính", "y chinh")


def _terms(text: str) -> set[str]:
    return {item for item in re.findall(r"\w+", text.casefold()) if len(item) > 2}


def _grounded_points(context: str, question: str, *, summary: bool) -> list[tuple[str, str]]:
    question_terms = _terms(question)
    candidates: list[tuple[float, int, str, str]] = []
    sequence = 0
    for match in _SOURCE_PATTERN.finditer(context):
        citation = f"[Nguồn {match.group('number')}]"
        for sentence in _SENTENCE_PATTERN.split(match.group("text")):
            clean = re.sub(r"\s+", " ", sentence).strip(" -•\t")
            if len(clean) < 35:
                continue
            overlap = len(question_terms & _terms(clean))
            score = (overlap * 4.0) + min(len(clean), 260) / 260
            if summary:
                score += max(0, 4 - sequence) * 0.15
            candidates.append((score, sequence, clean[:420], citation))
            sequence += 1
    ordered = sorted(candidates, key=lambda item: (-item[0], item[1]))
    chosen: list[tuple[str, str]] = []
    seen: set[str] = set()
    for _, _, sentence, citation in ordered:
        fingerprint = sentence.casefold()[:90]
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        chosen.append((sentence, citation))
        if len(chosen) >= (8 if summary else 6):
            break
    return chosen


class EminLocalProvider(LLMProvider):
    """Grounded extractive fallback used when no external model is configured."""

    @property
    def model_name(self) -> str:
        return "emin-local-grounded"

    async def generate(self, prompt: str, *, system: str | None = None) -> str:
        del system
        question = prompt.rsplit("Câu hỏi của sinh viên:", maxsplit=1)[-1].strip()
        if "Ngữ cảnh:" in prompt:
            context = prompt.split("Ngữ cảnh:", maxsplit=1)[1].split(
                "Câu hỏi của sinh viên:", maxsplit=1
            )[0].strip()
            lowered = question.casefold()
            summary = any(term in lowered for term in _SUMMARY_TERMS)
            points = _grounded_points(context, question, summary=summary)
            if not points:
                return (
                    "Emin AI chưa tìm thấy đoạn đủ rõ trong tài liệu để trả lời chính xác. "
                    "Hãy hỏi bằng tên khái niệm, chương hoặc từ khóa xuất hiện trong file."
                )
            heading = "Tóm tắt tài liệu" if summary else "Giải thích từ tài liệu"
            bullets = "\n".join(
                f"- {sentence} {citation}" for sentence, citation in points
            )
            if summary:
                return (
                    f"### {heading}\n\n{bullets}\n\n"
                    "**Gợi ý ôn tập:** Hãy chọn một ý phía trên và yêu cầu Emin AI "
                    "giải thích sâu hoặc tạo câu hỏi tự kiểm tra."
                )
            return (
                f"### {heading}\n\n{bullets}\n\n"
                "**Kết luận:** Các ý trên được rút trực tiếp từ file của môn học. "
                "Bạn có thể hỏi tiếp “giải thích từng bước” kèm đúng tên mục để đi sâu hơn."
            )
        lowered = question.casefold()
        if any(word in lowered for word in ("xin chào", "chào", "hello")):
            return (
                "Chào bạn, mình là Emin AI. Hãy chọn môn học có tài liệu ở trạng thái "
                "“Sẵn sàng”, sau đó yêu cầu mình giải thích hoặc tóm tắt nội dung."
            )
        return (
            "Môn học này chưa có tài liệu đã xử lý để Emin AI trả lời có căn cứ. "
            "Hãy tải PDF, DOCX, PPTX hoặc TXT trong mục Tài liệu, chờ trạng thái "
            "“Sẵn sàng”, rồi hỏi lại với tên chương hoặc khái niệm cụ thể."
        )

    async def stream(self, prompt: str, *, system: str | None = None) -> AsyncIterator[str]:
        yield await self.generate(prompt, system=system)

    async def structured_generate(
        self, prompt: str, schema: type[T], *, system: str | None = None
    ) -> T:
        raise AppError(
            "AI_MODEL_REQUIRED",
            "Tính năng tạo nội dung cần Ollama hoặc OpenAI-compatible provider",
            503,
        )
