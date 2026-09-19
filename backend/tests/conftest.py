import uuid
from collections.abc import AsyncIterator

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base
from app.models import User


@pytest_asyncio.fixture
async def session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        yield db
    await engine.dispose()


@pytest_asyncio.fixture
async def users(session: AsyncSession) -> tuple[User, User]:
    first = User(
        id=uuid.uuid4(),
        email="first@example.edu",
        password_hash="unused",
        full_name="First Student",
    )
    second = User(
        id=uuid.uuid4(),
        email="second@example.edu",
        password_hash="unused",
        full_name="Second Student",
    )
    session.add_all([first, second])
    await session.commit()
    return first, second
