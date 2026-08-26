from __future__ import annotations
"""tab_widget 组件表。"""
from sqlalchemy import BigInteger, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class Widget(Base):
    __tablename__ = "tab_widget"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    group_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str | None] = mapped_column(String(64), default=None)
    # rows 是 MySQL 保留字，需要 quote=True 让方言自动加反引号
    rows: Mapped[int] = mapped_column(Integer, name="rows", quote=True, nullable=False, default=1)
    cols: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    config: Mapped[str | None] = mapped_column(Text, default=None)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    x: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    y: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    enabled: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    __table_args__ = (Index("idx_widget_group", "group_id", "sort_order"),)
