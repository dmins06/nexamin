"""Candidate discovery is separate from explicit reuse-rights approval."""

from datetime import UTC, datetime
from urllib.parse import urlsplit

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError
from app.models.practice import QuestionSource


class SourceCandidate(BaseModel):
    name: str = Field(min_length=3, max_length=250)
    url: str = Field(max_length=1000)
    source_type: str = Field(min_length=3, max_length=40)
    institution: str | None = Field(default=None, max_length=250)
    subject_hint: str | None = Field(default=None, max_length=200)
    notes: str | None = None

    @field_validator("url")
    @classmethod
    def https_only(cls, value: str) -> str:
        parsed = urlsplit(value)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("Source URL must be public HTTPS without credentials.")
        return value


async def register_candidate(session: AsyncSession, candidate: SourceCandidate) -> QuestionSource:
    source = await session.scalar(select(QuestionSource).where(QuestionSource.url == candidate.url))
    if source is not None:
        return source
    source = QuestionSource(
        name=candidate.name,
        url=candidate.url,
        source_type=candidate.source_type,
        institution=candidate.institution,
        subject_hint=candidate.subject_hint,
        notes=candidate.notes,
        import_status="candidate",
    )
    session.add(source)
    await session.commit()
    return source


async def approve_source(
    session: AsyncSession, source: QuestionSource, license_name: str, rights_url: str
) -> None:
    if source.import_status == "rejected":
        raise AppError("SOURCE_REJECTED", "Nguồn đã bị từ chối; cần tạo hồ sơ duyệt mới.", 409)
    rights = urlsplit(rights_url)
    if not license_name.strip() or rights.scheme != "https" or not rights.hostname:
        raise AppError("SOURCE_RIGHTS_REQUIRED", "Cần giấy phép và liên kết chứng minh quyền sử dụng.", 422)
    source.license = license_name.strip()
    source.rights_url = rights_url
    source.import_status = "approved"
    source.retrieved_at = datetime.now(UTC)
    await session.commit()
