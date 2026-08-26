from __future__ import annotations
"""组件模块。"""
from typing import List, Optional

from pydantic import BaseModel, Field


class WidgetSaveIn(BaseModel):
    id: Optional[int] = None
    groupId: int
    type: str = Field(min_length=1, max_length=32)
    name: Optional[str] = None
    rows: Optional[int] = 1
    cols: Optional[int] = 1
    config: Optional[str] = None
    sortOrder: Optional[int] = None
    x: Optional[int] = None
    y: Optional[int] = None
    enabled: Optional[int] = None


class WidgetLayoutItem(BaseModel):
    id: int
    sortOrder: Optional[int] = None
    x: Optional[int] = None
    y: Optional[int] = None
    cols: Optional[int] = None
    rows: Optional[int] = None


class WidgetOut(BaseModel):
    id: int
    userId: int
    groupId: int
    type: str
    name: Optional[str] = None
    rows: int
    cols: int
    config: Optional[str] = None
    sortOrder: int
    x: int
    y: int
    enabled: int

    @classmethod
    def from_orm_row(cls, w) -> "WidgetOut":
        return cls(
            id=w.id,
            userId=w.user_id,
            groupId=w.group_id,
            type=w.type,
            name=w.name,
            rows=w.rows or 1,
            cols=w.cols or 1,
            config=w.config,
            sortOrder=w.sort_order or 0,
            x=w.x or 0,
            y=w.y or 0,
            enabled=w.enabled if w.enabled is not None else 1,
        )
