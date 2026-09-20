import importlib.util
import io
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations

PROJECT_ROOT = Path(__file__).parents[2]
VERSIONS = PROJECT_ROOT / "backend" / "alembic" / "versions"


def _load_revision(filename: str) -> ModuleType:
    path = VERSIONS / filename
    spec = importlib.util.spec_from_file_location(filename.removesuffix(".py"), path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load migration {filename}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class _Inspector:
    def __init__(
        self,
        *,
        columns: list[str],
        indexes: list[dict[str, Any]],
        unique_constraints: list[dict[str, Any]] | None = None,
    ) -> None:
        self._columns = columns
        self._indexes = indexes
        self._unique_constraints = unique_constraints or []

    def get_columns(self, table_name: str) -> list[dict[str, Any]]:
        assert table_name == "universities"
        return [{"name": name} for name in self._columns]

    def get_indexes(self, table_name: str) -> list[dict[str, Any]]:
        assert table_name == "universities"
        return self._indexes

    def get_unique_constraints(self, table_name: str) -> list[dict[str, Any]]:
        assert table_name == "universities"
        return self._unique_constraints


class _Operations:
    def __init__(self) -> None:
        self.added_columns: list[str] = []
        self.created_indexes: list[str] = []

    def get_bind(self) -> object:
        return object()

    def add_column(self, table_name: str, column: Any) -> None:
        self.added_columns.append(f"{table_name}.{column.name}")

    def create_index(
        self,
        name: str,
        table_name: str,
        columns: list[str],
        *,
        unique: bool,
    ) -> None:
        assert table_name == "universities"
        assert columns == ["official_code"]
        assert unique is True
        self.created_indexes.append(name)


def test_official_code_migration_accepts_existing_valid_schema(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    revision = _load_revision("0002_university_catalog.py")
    operations = _Operations()
    inspector = _Inspector(
        columns=["id", "name", "official_code"],
        indexes=[
            {
                "name": revision.INDEX_NAME,
                "column_names": ["official_code"],
                "unique": True,
            }
        ],
    )
    monkeypatch.setattr(revision, "op", operations)
    monkeypatch.setattr(revision.sa, "inspect", lambda _bind: inspector)

    revision._ensure_official_code_schema()

    assert operations.added_columns == []
    assert operations.created_indexes == []


def test_official_code_migration_rejects_conflicting_named_index(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    revision = _load_revision("0002_university_catalog.py")
    inspector = _Inspector(
        columns=["id", "name", "official_code"],
        indexes=[
            {
                "name": revision.INDEX_NAME,
                "column_names": ["name"],
                "unique": False,
            }
        ],
    )
    monkeypatch.setattr(revision, "op", _Operations())
    monkeypatch.setattr(revision.sa, "inspect", lambda _bind: inspector)

    with pytest.raises(RuntimeError, match="not a unique index"):
        revision._ensure_official_code_schema()


def test_migration_history_is_frozen_and_non_destructive() -> None:
    initial = (VERSIONS / "0001_initial.py").read_text(encoding="utf-8")
    catalog = (VERSIONS / "0002_university_catalog.py").read_text(encoding="utf-8")
    dockerfile = (PROJECT_ROOT / "Dockerfile").read_text(encoding="utf-8")

    assert "Base.metadata.create_all" not in initial
    assert "app.models" not in initial
    assert "official_code" not in initial
    assert "friendships" not in initial
    assert "direct_messages" not in initial
    assert "sa.delete" not in catalog
    assert "DELETE FROM" not in catalog.upper()
    assert "scripts/init_dev_db.py" not in dockerfile
    assert dockerfile.count("alembic upgrade head") == 1


def test_initial_revision_compiles_as_frozen_postgresql_ddl() -> None:
    revision = _load_revision("0001_initial.py")
    output = io.StringIO()
    context = MigrationContext.configure(
        dialect_name="postgresql",
        opts={"as_sql": True, "output_buffer": output},
    )

    with Operations.context(context):
        revision.upgrade()

    ddl = output.getvalue()
    assert "CREATE TABLE universities" in ddl
    assert "official_code" not in ddl
    assert "friendships" not in ddl
    assert "direct_messages" not in ddl
