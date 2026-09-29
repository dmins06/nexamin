import importlib.util
import uuid
from pathlib import Path
from types import ModuleType

import pytest
import sqlalchemy as sa
from alembic.operations import Operations
from alembic.runtime.migration import MigrationContext
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models import University, User
from app.services.electives import ElectiveRecommendationService

VERSIONS = Path(__file__).resolve().parents[1] / "alembic" / "versions"


def load_migration(filename: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(filename.removesuffix(".py"), VERSIONS / filename)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_practice_and_uth_migrations_are_additive_and_import_approved_rows() -> None:
    engine = sa.create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        University.__table__.create(connection)
        User.__table__.create(connection)
        uth_id = "3ea0c880-8a55-4d4d-9646-009b67c43dc1"
        connection.execute(
            sa.text(
                "INSERT INTO universities (id, official_code, name, short_name, country, is_verified) "
                "VALUES (:id, 'UTH', 'Trường Đại học Giao thông vận tải TP.HCM', 'UTH', 'Vietnam', 1)"
            ),
            {"id": uth_id.replace("-", "")},
        )
        context = MigrationContext.configure(connection)
        with Operations.context(context):
            load_migration("0010_practice_bank.py").upgrade()
            load_migration("0011_curriculum_catalog.py").upgrade()
            load_migration("0012_practice_sources.py").upgrade()
        assert connection.execute(sa.text("SELECT count(*) FROM curriculum_courses")).scalar_one() == 6971
        assert connection.execute(sa.text("SELECT count(*) FROM curriculum_versions")).scalar_one() >= 100
        assert connection.execute(sa.text("SELECT count(*) FROM elective_groups")).scalar_one() > 0
        assert connection.execute(sa.text("SELECT count(*) FROM practice_subjects")).scalar_one() == 0
        assert connection.execute(sa.text("SELECT count(*) FROM question_sources")).scalar_one() == 0
    engine.dispose()


@pytest.mark.asyncio
async def test_real_uth_ai_major_resolves_and_recommends_for_two_careers(tmp_path: Path) -> None:
    database_path = tmp_path / "uth-advisor.db"
    engine = sa.create_engine(f"sqlite:///{database_path}")
    with engine.begin() as connection:
        University.__table__.create(connection)
        User.__table__.create(connection)
        connection.execute(
            sa.text(
                "INSERT INTO universities (id, official_code, name, short_name, country, is_verified) "
                "VALUES (:id, 'UTH', 'Trường Đại học Giao thông vận tải TP.HCM', 'UTH', 'Vietnam', 1)"
            ),
            {"id": uuid.uuid4().hex},
        )
        with Operations.context(MigrationContext.configure(connection)):
            load_migration("0011_curriculum_catalog.py").upgrade()
    engine.dispose()

    async_engine = create_async_engine(f"sqlite+aiosqlite:///{database_path}")
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        university = (await session.scalars(sa.select(University))).one()
        user = User(
            email="advisor@example.edu",
            password_hash="unused",
            full_name="UTH Student",
            university=university,
            major="Công nghệ thông tin (chuyên ngành Khoa học dữ liệu và AI) - chương trình tiên tiến",
        )
        session.add(user)
        await session.commit()
        service = ElectiveRecommendationService(session, user)
        resolution = await service.resolve()
        assert resolution.status == "ready"
        assert {2024, 2025}.issubset({item.cohort for item in resolution.curricula})
        version = next(item for item in resolution.curricula if item.cohort == 2024)
        assert version.specialization == "Khoa học dữ liệu và AI"
        assert version.elective_count > 0
        for career in ("ai_engineer", "data_scientist"):
            plan = await service.recommend(version.id, career)
            assert plan.courses, career
            assert all(course.curriculum_course_id for course in plan.courses)
        for registered_major in (
            "Logistics và quản lý chuỗi cung ứng - chương trình tiên tiến",
            "Kỹ thuật điện (chuyên ngành Điện công nghiệp; Hệ thống điện giao thông; Năng lượng tái tạo) - chương trình tiên tiến",
            "Kỹ thuật môi trường (chuyên ngành Kỹ thuật môi trường; Quản lý an toàn và môi trường)",
            "Kỹ thuật ô tô (chuyên ngành Cơ khí ô tô; Cơ điện tử ô tô) - chương trình tiên tiến",
            "Ngôn ngữ Anh – chương trình tiên tiến",
        ):
            user.major = registered_major
            assert (await service.resolve()).status == "ready", registered_major
        user.major = "Luật – chương trình tiên tiến"
        assert (await service.resolve()).status == "program_not_mapped"
        user.major = "Khoa hoc du lieu & AI"
        assert (await service.resolve()).status == "ready"
        user.major = "Ngành không có trong dữ liệu"
        assert (await service.resolve()).status == "program_not_mapped"
    await async_engine.dispose()
