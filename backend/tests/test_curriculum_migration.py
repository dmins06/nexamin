import importlib.util
from pathlib import Path
from types import ModuleType

import sqlalchemy as sa
from alembic.operations import Operations
from alembic.runtime.migration import MigrationContext

from app.models import University, User

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
        assert connection.execute(sa.text("SELECT count(*) FROM curriculum_courses")).scalar_one() == 6971
        assert connection.execute(sa.text("SELECT count(*) FROM curriculum_versions")).scalar_one() >= 100
        assert connection.execute(sa.text("SELECT count(*) FROM elective_groups")).scalar_one() > 0
        assert connection.execute(sa.text("SELECT count(*) FROM practice_subjects")).scalar_one() == 0
    engine.dispose()
