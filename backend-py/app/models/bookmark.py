from __future__ import annotations
"""tab_bookmark 书签表。"""
from sqlalchemy import BigInteger, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class Bookmark(Base):
    __tablename__ = "tab_bookmark"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    group_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    parent_id: Mapped[int | None] = mapped_column(BigInteger, default=None)
    type: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="0=书签 1=文件夹")
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    url: Mapped[str | None] = mapped_column(String(512), default=None)
    icon_type: Mapped[str] = mapped_column(String(16), nullable=False, default="favicon")
    icon_value: Mapped[str | None] = mapped_column(String(512), default=None)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (Index("idx_group_parent", "group_id", "parent_id", "sort_order"),)
