"""Refresh university websites and logo URLs from the catalog.

Revision ID: 0003
Revises: 0002
"""

import csv
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    catalog_path = Path(__file__).parents[2] / "data" / "vietnam_universities.csv"
    with catalog_path.open(encoding="utf-8", newline="") as source:
        rows = [
            {
                "official_code": row["official_code"],
                "logo_url": row["logo_url"] or None,
                "website": row["website"] or None,
                "email_domain": row["email_domain"] or None,
            }
            for row in csv.DictReader(source)
        ]

    statement = sa.text(
        """
        UPDATE universities
        SET logo_url = :logo_url,
            website = :website,
            email_domain = :email_domain,
            is_verified = TRUE
        WHERE official_code = :official_code
        """
    )
    op.get_bind().execute(statement, rows)


def downgrade() -> None:
    # Catalog metadata is intentionally retained on downgrade.
    pass
