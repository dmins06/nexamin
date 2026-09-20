"""Create and seed the lightweight SQLite database used by local development."""

import asyncio
import csv
import uuid
from pathlib import Path

from sqlalchemy import select

from app.database import Base, SessionFactory, engine
from app.models import University


async def initialize() -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

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
