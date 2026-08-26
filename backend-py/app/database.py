from __future__ import annotations
"""异步 SQLAlchemy 引擎与会话。"""
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    pool_size=5,
    max_overflow=5,
    pool_recycle=1800,
    pool_pre_ping=True,
    pool_timeout=10,
    connect_args={"connect_timeout": 5},
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine, expire_on_commit=False, class_=AsyncSession
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
