from __future__ import annotations
"""分组模块。"""
from typing import List, Optional

from pydantic import BaseModel, Field


class GroupSaveIn(BaseModel):
    id: Optional[int] = None
    name: str = Field(min_length=1, max_length=64)
    icon: Optional[str] = None


class GroupSortItem(BaseModel):
    id: int
    sortOrder: int


class GroupOut(BaseModel):
    id: int
    userId: int
    name: str
    icon: str
    sortOrder: int

    @classmethod
    def from_orm_row(cls, g) -> "GroupOut":
        return cls(
            id=g.id,
            userId=g.user_id,
            name=g.name,
            icon=g.icon or "",
            sortOrder=g.sort_order,
        )
