from __future__ import annotations
"""书签模块。"""
from typing import Optional

from pydantic import BaseModel, Field


class BookmarkSaveIn(BaseModel):
    id: Optional[int] = None
    groupId: int
    parentId: Optional[int] = None
    type: Optional[int] = 0
    name: str = Field(min_length=1, max_length=128)
    url: Optional[str] = None
    iconType: Optional[str] = "favicon"
    iconValue: Optional[str] = None
    sortOrder: Optional[int] = None


class BookmarkMoveIn(BaseModel):
    id: int
    groupId: Optional[int] = None
    parentId: Optional[int] = None
    sortOrder: Optional[int] = None


class BookmarkSortItem(BaseModel):
    id: int
    parentId: Optional[int] = None
    sortOrder: int


class BookmarkOut(BaseModel):
    id: int
    userId: int
    groupId: int
    parentId: Optional[int] = None
    type: int
    name: str
    url: Optional[str] = None
    iconType: str
    iconValue: Optional[str] = None
    sortOrder: int

    @classmethod
    def from_orm_row(cls, b) -> "BookmarkOut":
        return cls(
            id=b.id,
            userId=b.user_id,
            groupId=b.group_id,
            parentId=b.parent_id,
            type=b.type or 0,
            name=b.name,
            url=b.url,
            iconType=b.icon_type or "favicon",
            iconValue=b.icon_value,
            sortOrder=b.sort_order or 0,
        )
