from __future__ import annotations
"""搜索引擎模块。"""
from typing import Optional

from pydantic import BaseModel, Field


class EngineSaveIn(BaseModel):
    id: Optional[int] = None
    name: str = Field(min_length=1, max_length=64)
    urlTemplate: str = Field(min_length=1, max_length=512)
    icon: Optional[str] = None
    isDefault: Optional[int] = 0


class EngineOut(BaseModel):
    id: int
    userId: int
    name: str
    urlTemplate: str
    icon: Optional[str] = None
    isDefault: int

    @classmethod
    def from_orm_row(cls, e) -> "EngineOut":
        return cls(
            id=e.id,
            userId=e.user_id,
            name=e.name,
            urlTemplate=e.url_template,
            icon=e.icon,
            isDefault=e.is_default or 0,
        )
