"""Initial StudyHub schema.

Revision ID: 0001
Revises: None
"""

import uuid
from collections.abc import Sequence

from sqlalchemy import column, table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.types import Boolean, String

from alembic import op
from app.database import Base
from app.models import entities  # noqa: F401

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind, checkfirst=True)
    universities = table(
        "universities",
        column("id", UUID(as_uuid=True)),
        column("name", String),
        column("short_name", String),
        column("email_domain", String),
        column("country", String),
        column("website", String),
        column("is_verified", Boolean),
    )
    op.bulk_insert(
        universities,
        [
            {
                "id": uuid.uuid4(),
                "name": "University of Transport Ho Chi Minh City",
                "short_name": "UTH",
                "email_domain": "uth.edu.vn",
                "country": "Vietnam",
                "website": "https://ut.edu.vn",
                "is_verified": True,
            },
            {
                "id": uuid.uuid4(),
                "name": "Ho Chi Minh City University of Technology",
                "short_name": "HCMUT",
                "email_domain": "hcmut.edu.vn",
                "country": "Vietnam",
                "website": "https://hcmut.edu.vn",
                "is_verified": True,
            },
            {
                "id": uuid.uuid4(),
                "name": "University of Information Technology",
                "short_name": "UIT",
                "email_domain": "uit.edu.vn",
                "country": "Vietnam",
                "website": "https://uit.edu.vn",
                "is_verified": True,
            },
            {
                "id": uuid.uuid4(),
                "name": "University of Economics Ho Chi Minh City",
                "short_name": "UEH",
                "email_domain": "ueh.edu.vn",
                "country": "Vietnam",
                "website": "https://ueh.edu.vn",
                "is_verified": True,
            },
            {
                "id": uuid.uuid4(),
                "name": "RMIT University Vietnam",
                "short_name": "RMIT Vietnam",
                "email_domain": "rmit.edu.vn",
                "country": "Vietnam",
                "website": "https://rmit.edu.vn",
                "is_verified": True,
            },
        ],
    )


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind(), checkfirst=True)
    op.execute("DROP EXTENSION IF EXISTS vector")
