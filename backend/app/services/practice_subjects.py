"""Resolve source spellings to one reusable academic practice subject."""

import re
import unicodedata

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.curriculum import CatalogCourse
from app.models.practice import PracticeSubject, PracticeSubjectCatalogCourse

INITIAL_SUBJECTS = (
    "Triết học Mác – Lênin",
    "Kinh tế chính trị Mác – Lênin",
    "Chủ nghĩa xã hội khoa học",
    "Tư tưởng Hồ Chí Minh",
    "Lịch sử Đảng Cộng sản Việt Nam",
)


def subject_key(value: str) -> str:
    folded = unicodedata.normalize("NFD", value.casefold().replace("đ", "d"))
    plain = "".join(char for char in folded if not unicodedata.combining(char))
    plain = re.sub(r"\bmarx\b", "mac", plain)
    return " ".join(re.findall(r"[a-z0-9]+", plain))


async def resolve_subject(session: AsyncSession, raw_name: str) -> PracticeSubject:
    key = subject_key(raw_name)
    if not key:
        raise ValueError("Subject name is empty.")
    canonical = next((name for name in INITIAL_SUBJECTS if subject_key(name) == key), raw_name.strip())
    subjects = (await session.scalars(select(PracticeSubject))).all()
    existing = next((subject for subject in subjects if subject_key(subject.name) == key), None)
    if existing is not None:
        subject = existing
    else:
        subject = PracticeSubject(name=canonical)
        session.add(subject)
        await session.flush()
    catalog = (await session.scalars(select(CatalogCourse))).all()
    linked = set((await session.scalars(select(PracticeSubjectCatalogCourse.catalog_course_id).where(
        PracticeSubjectCatalogCourse.subject_id == subject.id
    ))).all())
    for course in catalog:
        if subject_key(course.name) == key and course.id not in linked:
            session.add(PracticeSubjectCatalogCourse(subject_id=subject.id, catalog_course_id=course.id))
    return subject
