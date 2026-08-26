from __future__ import annotations
"""用户设置模块。"""
from typing import Optional

from pydantic import BaseModel


class SettingsIn(BaseModel):
    theme: Optional[str] = None
    searchEngineId: Optional[int] = None
    backgroundType: Optional[str] = None
    backgroundValue: Optional[str] = None
    backgroundAnimation: Optional[int] = None
    bookmarkOpenTarget: Optional[str] = None
    autoFocusSearch: Optional[int] = None
    transitionAnimation: Optional[str] = None
    primaryColor: Optional[str] = None
    uiOpacity: Optional[int] = None
    bgOverlayOpacity: Optional[int] = None


class SettingsOut(BaseModel):
    id: int
    userId: int
    theme: str
    searchEngineId: Optional[int] = None
    backgroundType: str
    backgroundValue: Optional[str] = None
    backgroundAnimation: int
    bookmarkOpenTarget: str
    autoFocusSearch: int
    transitionAnimation: str
    primaryColor: Optional[str] = None
    uiOpacity: int = 100
    bgOverlayOpacity: int = 100

    @classmethod
    def from_orm_row(cls, s) -> "SettingsOut":
        return cls(
            id=s.id,
            userId=s.user_id,
            theme=s.theme or "light",
            searchEngineId=s.search_engine_id,
            backgroundType=s.background_type or "bing",
            backgroundValue=s.background_value,
            backgroundAnimation=s.background_animation or 0,
            bookmarkOpenTarget=s.bookmark_open_target or "new",
            autoFocusSearch=s.auto_focus_search if s.auto_focus_search is not None else 1,
            transitionAnimation=s.transition_animation or "flip",
            primaryColor=getattr(s, "primary_color", None),
            uiOpacity=getattr(s, "ui_opacity", 100) if getattr(s, "ui_opacity", None) is not None else 100,
            bgOverlayOpacity=getattr(s, "bg_overlay_opacity", 100) if getattr(s, "bg_overlay_opacity", None) is not None else 100,
        )
