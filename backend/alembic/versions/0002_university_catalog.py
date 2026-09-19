"""Import the nationwide MOET admissions institution catalog.

Revision ID: 0002
Revises: 0001
"""

import csv
import uuid
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("universities", sa.Column("official_code", sa.String(30), nullable=True))
    op.create_index(
        "ix_universities_official_code", "universities", ["official_code"], unique=True
    )

    catalog_path = Path(__file__).parents[2] / "data" / "vietnam_universities.csv"
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
    with catalog_path.open(encoding="utf-8", newline="") as source:
        rows = [
            {
                "id": uuid.uuid5(uuid.NAMESPACE_URL, f"studyhub:moet:{row['official_code']}"),
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

    # The first migration had five English demo rows. Replace those with the
    # authoritative catalog so search and registration expose one clean list.
    op.execute(sa.delete(university))
    op.bulk_insert(university, rows)


def downgrade() -> None:
    op.drop_index("ix_universities_official_code", table_name="universities")
    op.drop_column("universities", "official_code")
