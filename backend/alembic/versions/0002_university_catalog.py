"""Add the official university catalog without replacing existing rows.

Revision ID: 0002
Revises: 0001
"""

import csv
import uuid
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, insert

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

INDEX_NAME = "ix_universities_official_code"


def _ensure_official_code_schema() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {item["name"] for item in inspector.get_columns("universities")}
    if "official_code" not in columns:
        op.add_column(
            "universities",
            sa.Column("official_code", sa.String(length=30), nullable=True),
        )
        inspector = sa.inspect(bind)

    indexes = {item["name"]: item for item in inspector.get_indexes("universities")}
    named_index = indexes.get(INDEX_NAME)
    if named_index is not None:
        is_expected = named_index.get("column_names") == ["official_code"] and bool(
            named_index.get("unique")
        )
        if not is_expected:
            raise RuntimeError(f"{INDEX_NAME} exists but is not a unique index on official_code")
        return

    unique_constraints = inspector.get_unique_constraints("universities")
    has_unique_code = any(
        item.get("column_names") == ["official_code"] for item in unique_constraints
    )
    has_unique_index = any(
        item.get("column_names") == ["official_code"] and bool(item.get("unique"))
        for item in indexes.values()
    )
    if not has_unique_code and not has_unique_index:
        op.create_index(
            INDEX_NAME,
            "universities",
            ["official_code"],
            unique=True,
        )


def _catalog_rows() -> list[dict[str, Any]]:
    catalog_path = Path(__file__).parents[2] / "data" / "vietnam_universities.csv"
    with catalog_path.open(encoding="utf-8", newline="") as source:
        return [
            {
                "id": uuid.uuid5(
                    uuid.NAMESPACE_URL,
                    f"studyhub:moet:{row['official_code']}",
                ),
                "official_code": row["official_code"],
                "name": row["name"],
                "short_name": row["short_name"],
                "logo_url": row["logo_url"] or None,
                "email_domain": row["email_domain"] or None,
                "country": "Vietnam",
                "website": row["website"] or None,
                "is_verified": True,
            }
            for row in csv.DictReader(source)
        ]


def _merge_catalog() -> None:
    bind = op.get_bind()
    university = sa.table(
        "universities",
        sa.column("id", UUID(as_uuid=True)),
        sa.column("official_code", sa.String),
        sa.column("name", sa.String),
        sa.column("short_name", sa.String),
        sa.column("logo_url", sa.String),
        sa.column("email_domain", sa.String),
        sa.column("country", sa.String),
        sa.column("website", sa.String),
        sa.column("is_verified", sa.Boolean),
    )

    for row in _catalog_rows():
        code_exists = bind.execute(
            sa.select(university.c.id)
            .where(university.c.official_code == row["official_code"])
            .limit(1)
        ).scalar_one_or_none()
        if code_exists is not None:
            continue

        matches = [
            sa.func.lower(university.c.name) == row["name"].lower(),
            sa.func.lower(university.c.short_name) == row["short_name"].lower(),
        ]
        if row["email_domain"]:
            matches.append(
                sa.func.lower(university.c.email_domain) == str(row["email_domain"]).lower()
            )

        existing_id = bind.execute(
            sa.select(university.c.id)
            .where(
                university.c.official_code.is_(None),
                sa.or_(*matches),
            )
            .limit(1)
        ).scalar_one_or_none()
        if existing_id is not None:
            bind.execute(
                sa.update(university)
                .where(university.c.id == existing_id)
                .values(official_code=row["official_code"])
            )
            continue

        bind.execute(insert(university).values(**row).on_conflict_do_nothing())


def upgrade() -> None:
    _ensure_official_code_schema()
    _merge_catalog()


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    indexes = {item["name"] for item in inspector.get_indexes("universities")}
    if INDEX_NAME in indexes:
        op.drop_index(INDEX_NAME, table_name="universities")

    columns = {item["name"] for item in inspector.get_columns("universities")}
    if "official_code" in columns:
        op.drop_column("universities", "official_code")
