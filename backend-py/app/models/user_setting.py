from __future__ import annotations
"""tab_user_setting 用户设置表。"""
from sqlalchemy import BigInteger, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class UserSetting(Base):
    __tablename__ = "tab_user_setting"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False, unique=True)
    theme: Mapped[str] = mapped_column(String(16), nullable=False, default="light")
    search_engine_id: Mapped[int | None] = mapped_column(BigInteger, default=None)
    background_type: Mapped[str] = mapped_column(String(16), nullable=False, default="bing")
    background_value: Mapped[str | None] = mapped_column(String(512), default=None)
    background_animation: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    bookmark_open_target: Mapped[str] = mapped_column(String(16), nullable=False, default="new")
    auto_focus_search: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    transition_animation: Mapped[str] = mapped_column(String(16), nullable=False, default="flip")
    primary_color: Mapped[str | None] = mapped_column(String(16), default=None)
    # 界面毛玻璃透明度百分比（0-100），100 表示使用默认视觉效果
    ui_opacity: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    # 背景遮罩透明度百分比（0-100），100 表示使用默认视觉效果
    bg_overlay_opacity: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
