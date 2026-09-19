import unicodedata
import uuid

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.core.exceptions import NotFoundError
from app.dependencies import DBSession
from app.models import University
from app.schemas import Page, UniversityResponse

router = APIRouter(prefix="/universities", tags=["Universities"])


def _normalized(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value)
    without_marks = "".join(
        character for character in decomposed if not unicodedata.combining(character)
    )
    return without_marks.replace("đ", "d").replace("Đ", "D").casefold()


@router.get("", response_model=Page[UniversityResponse])
async def list_universities(
    session: DBSession, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)
) -> Page[UniversityResponse]:
    total = await session.scalar(select(func.count()).select_from(University)) or 0
    rows = list(
        (
            await session.scalars(
                select(University)
                .order_by(University.name)
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()
    )
    return Page(
        items=[UniversityResponse.model_validate(row) for row in rows],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/search", response_model=Page[UniversityResponse])
async def search_universities(
    session: DBSession,
    q: str = Query(min_length=1, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Page[UniversityResponse]:
    # The catalog is intentionally small (426 records). Filtering this bounded
    # set in Python keeps accent-insensitive search identical on PostgreSQL and
    # SQLite without requiring a database-specific unaccent extension.
    catalog = list((await session.scalars(select(University).order_by(University.name))).all())
    keyword = _normalized(q.strip())
    matches = [
        university
        for university in catalog
        if keyword
        in _normalized(
            f"{university.official_code or ''} {university.short_name} {university.name}"
        )
    ]
    offset = (page - 1) * page_size
    rows = matches[offset : offset + page_size]
    return Page(
        items=[UniversityResponse.model_validate(row) for row in rows],
        page=page,
        page_size=page_size,
        total=len(matches),
    )


@router.get("/{university_id}", response_model=UniversityResponse)
async def get_university(university_id: uuid.UUID, session: DBSession) -> UniversityResponse:
    row = await session.get(University, university_id)
    if row is None:
        raise NotFoundError("UNIVERSITY_NOT_FOUND", "University not found")
    return UniversityResponse.model_validate(row)
