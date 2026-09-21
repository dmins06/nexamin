"""Create and seed the lightweight SQLite database used by local development."""

import asyncio
import csv
import uuid
from pathlib import Path

from sqlalchemy import inspect, select, text

from app.config import settings
from app.database import Base, SessionFactory, engine
from app.models import University


async def initialize() -> None:
    if settings.app_env == "production" or engine.url.get_backend_name() != "sqlite":
        raise RuntimeError("init_dev_db.py is restricted to local SQLite development")

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

        # Local SQLite predates Alembic in this project. Reconcile only additive
        # columns here; PostgreSQL production remains governed by Alembic.
        columns = await connection.run_sync(
            lambda sync_connection: {
                item["name"] for item in inspect(sync_connection).get_columns("courses")
            }
        )
        additions = {
            "credits": "INTEGER NOT NULL DEFAULT 3",
            "final_score": "FLOAT",
            "is_completed": "BOOLEAN NOT NULL DEFAULT 0",
            "completed_at": "DATETIME",
        }
        for name, definition in additions.items():
            if name not in columns:
                await connection.execute(
                    text(f"ALTER TABLE courses ADD COLUMN {name} {definition}")
                )

    async with SessionFactory() as session:
        existing_codes = set(
            (
                await session.scalars(
                    select(University.official_code).where(University.official_code.is_not(None))
                )
            ).all()
        )

        catalog_path = Path(__file__).parents[1] / "data" / "vietnam_universities.csv"
        with catalog_path.open(encoding="utf-8", newline="") as source:
            universities = [
                University(
                    id=uuid.uuid5(
                        uuid.NAMESPACE_URL,
                        f"studyhub:moet:{row['official_code']}",
                    ),
                    official_code=row["official_code"],
                    name=row["name"],
                    short_name=row["short_name"],
                    logo_url=row["logo_url"] or None,
                    website=row["website"] or None,
                    email_domain=row["email_domain"] or None,
                    country="Vietnam",
                    is_verified=True,
                )
                for row in csv.DictReader(source)
                if row["official_code"] not in existing_codes
            ]

        if universities:
            session.add_all(universities)
            await session.commit()
        print(f"Seeded {len(universities)} missing universities.")


if __name__ == "__main__":
    asyncio.run(initialize())
