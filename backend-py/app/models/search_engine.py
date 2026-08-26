from __future__ import annotations
"""tab_search_engine 搜索引擎表。"""
from sqlalchemy import BigInteger, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class SearchEngine(Base):
    __tablename__ = "tab_search_engine"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    url_template: Mapped[str] = mapped_column(String(512), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(255), default=None)
    is_default: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (Index("idx_engine_user", "user_id"),)
