import csv
from pathlib import Path

import pytest
from sqlalchemy import select

from app.models import University, User
from app.schemas import UserCreate
from app.services.auth import AuthService


def test_official_catalog_is_complete_and_unique() -> None:
    catalog = Path(__file__).parents[1] / "data" / "vietnam_universities.csv"
    with catalog.open(encoding="utf-8", newline="") as source:
        rows = list(csv.DictReader(source))
    codes = [row["official_code"] for row in rows]
    assert len(rows) == 426
    assert len(codes) == len(set(codes))
    assert {"BKA", "QSB", "VLU", "BUV"}.issubset(codes)


@pytest.mark.asyncio
async def test_registration_persists_selected_university(session) -> None:
    university = University(
        official_code="TST",
        name="Test University",
        short_name="TST",
        logo_url=None,
        email_domain=None,
        website=None,
        is_verified=True,
    )
    session.add(university)
    await session.commit()
    await AuthService(session).register(
        UserCreate(
            email="learner@example.edu",
            password="StrongPass123",
            full_name="Learner",
            university_id=university.id,
        )
    )
    user = await session.scalar(select(User).where(User.email == "learner@example.edu"))
    assert user is not None
    stored = await session.scalar(select(University).where(University.id == user.university_id))
    assert stored is not None
    assert stored.official_code == "TST"
