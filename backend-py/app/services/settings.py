from __future__ import annotations
"""用户设置业务。"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import UserSetting
from ..schemas.settings import SettingsIn


async def get_settings(db: AsyncSession, uid: int) -> UserSetting:
    res = await db.execute(select(UserSetting).where(UserSetting.user_id == uid))
    s: UserSetting | None = res.scalar_one_or_none()
    if s is None:
        s = UserSetting(
            user_id=uid,
            theme="light",
            background_type="bing",
            background_animation=0,
            bookmark_open_target="new",
            auto_focus_search=1,
            transition_animation="flip",
        )
        db.add(s)
        await db.commit()
        await db.refresh(s)
    return s


async def update_settings(db: AsyncSession, uid: int, dto: SettingsIn) -> UserSetting:
    s = await get_settings(db, uid)
    if dto.theme is not None:
        s.theme = dto.theme
    if dto.searchEngineId is not None:
        s.search_engine_id = dto.searchEngineId
    if dto.backgroundType is not None:
        s.background_type = dto.backgroundType
    if dto.backgroundValue is not None:
        s.background_value = dto.backgroundValue
    if dto.backgroundAnimation is not None:
        s.background_animation = dto.backgroundAnimation
    if dto.bookmarkOpenTarget is not None:
        s.bookmark_open_target = dto.bookmarkOpenTarget
    if dto.autoFocusSearch is not None:
        s.auto_focus_search = dto.autoFocusSearch
    if dto.transitionAnimation is not None:
        s.transition_animation = dto.transitionAnimation
    if dto.primaryColor is not None:
        s.primary_color = dto.primaryColor or None
    if dto.uiOpacity is not None:
        s.ui_opacity = max(0, min(100, dto.uiOpacity))
    if dto.bgOverlayOpacity is not None:
        s.bg_overlay_opacity = max(0, min(100, dto.bgOverlayOpacity))
    await db.commit()
    await db.refresh(s)
    return s
