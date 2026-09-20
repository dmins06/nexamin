from collections.abc import AsyncIterator
from typing import TypeVar

from pydantic import BaseModel

from app.ai.providers.base import LLMProvider
from app.core.exceptions import AppError

T = TypeVar("T", bound=BaseModel)


class EminLocalProvider(LLMProvider):
    """Dependency-free fallback so the tutor remains usable during local setup."""

    @property
    def model_name(self) -> str:
        return "emin-local"

    async def generate(self, prompt: str, *, system: str | None = None) -> str:
        question = prompt.rsplit("Câu hỏi của sinh viên:", maxsplit=1)[-1].strip()
        if "Ngữ cảnh:" in prompt:
            context = prompt.split("Ngữ cảnh:", maxsplit=1)[1].split(
                "Câu hỏi của sinh viên:", maxsplit=1
            )[0].strip()
            excerpt = context[:1400].rsplit(" ", maxsplit=1)[0]
            return (
                "Mình là Emin AI. Dựa trên tài liệu của môn học, phần liên quan nhất là:\n\n"
                f"{excerpt}\n\n"
                f"Với câu hỏi “{question}”, bạn hãy đối chiếu các ý trên với nguồn trích dẫn "
                "bên dưới. Nếu muốn, hãy hỏi cụ thể hơn để mình phân tích từng bước."
            )
        lowered = question.casefold()
        if any(word in lowered for word in ("xin chào", "chào", "hello", "hi ")):
            return (
                "Chào bạn, mình là Emin AI — trợ lý học tập của StudyHubAI. "
                "Bạn có thể hỏi mình về môn học, cách lập kế hoạch hoặc tải tài liệu lên để nhận câu trả lời có trích dẫn."
            )
        return (
            "Mình là Emin AI và đã nhận câu hỏi của bạn. Môn học này chưa có nguồn tài liệu để mình "
            "đưa ra câu trả lời đáng tin cậy có trích dẫn. Hãy tải PDF, DOCX hoặc PPTX liên quan, "
            f"sau đó hỏi lại: “{question}”. Trong lúc đó, bạn có thể chia nội dung thành khái niệm, "
            "ví dụ và bài tập để học từng bước."
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
