from __future__ import annotations
"""tab_user 用户表。"""
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class User(Base):
    __tablename__ = "tab_user"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(128), default=None)
    password: Mapped[str] = mapped_column(String(128), nullable=False)
    # 改一次密码 +1：JWT 里带同一个版本号，版本号对不上的 token 直接失效
    pwd_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)
    avatar: Mapped[str | None] = mapped_column(String(255), default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
