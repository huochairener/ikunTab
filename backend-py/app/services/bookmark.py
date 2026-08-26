from __future__ import annotations
"""书签业务。"""
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..exceptions import BizException
from ..models import Bookmark
from ..schemas.bookmark import BookmarkSaveIn, BookmarkMoveIn, BookmarkSortItem


async def list_bookmarks(db: AsyncSession, uid: int, group_id: int) -> List[Bookmark]:
    res = await db.execute(
        select(Bookmark)
        .where(Bookmark.user_id == uid, Bookmark.group_id == group_id)
        .order_by(Bookmark.sort_order.asc())
    )
    return list(res.scalars())


async def save_bookmark(db: AsyncSession, uid: int, dto: BookmarkSaveIn) -> Bookmark:
    if dto.id:
        b = await db.get(Bookmark, dto.id)
        if b is None or b.user_id != uid:
            raise BizException("书签不存在", 404)
        b.name = dto.name
        b.url = dto.url
        b.type = dto.type if dto.type is not None else 0
        b.parent_id = dto.parentId
        b.icon_type = dto.iconType or "favicon"
        b.icon_value = dto.iconValue
        if dto.sortOrder is not None:
            b.sort_order = dto.sortOrder
        await db.commit()
        await db.refresh(b)
        return b
    # 新建
    res = await db.execute(
        select(Bookmark).where(Bookmark.user_id == uid, Bookmark.group_id == dto.groupId)
    )
    existing = list(res.scalars())
    max_sort = max((b.sort_order for b in existing), default=-1)
    b = Bookmark(
        user_id=uid,
        group_id=dto.groupId,
        parent_id=dto.parentId,
        type=dto.type or 0,
        name=dto.name,
        url=dto.url,
        icon_type=dto.iconType or "favicon",
        icon_value=dto.iconValue,
        sort_order=dto.sortOrder if dto.sortOrder is not None else (max_sort + 1),
    )
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return b


async def delete_bookmark(db: AsyncSession, uid: int, bid: int) -> None:
    b = await db.get(Bookmark, bid)
    if b is None or b.user_id != uid:
        return
    if b.type == 1:
        # 文件夹：级联删除子项
        res = await db.execute(
            select(Bookmark).where(
                Bookmark.user_id == uid,
                Bookmark.group_id == b.group_id,
                Bookmark.parent_id == bid,
            )
        )
        for child in res.scalars():
            await db.delete(child)
    await db.delete(b)
    await db.commit()


async def move_bookmark(db: AsyncSession, uid: int, dto: BookmarkMoveIn) -> None:
    b = await db.get(Bookmark, dto.id)
    if b is None or b.user_id != uid:
        raise BizException("书签不存在", 404)
    b.group_id = dto.groupId if dto.groupId is not None else b.group_id
    # 0 或 None 视为顶层
    b.parent_id = dto.parentId if (dto.parentId and dto.parentId > 0) else None
    if dto.sortOrder is not None:
        b.sort_order = dto.sortOrder
    await db.commit()


async def sort_bookmarks(db: AsyncSession, uid: int, items: List[BookmarkSortItem]) -> None:
    for it in items:
        b = await db.get(Bookmark, it.id)
        if b is None or b.user_id != uid:
            continue
        b.parent_id = it.parentId if (it.parentId and it.parentId > 0) else None
        b.sort_order = it.sortOrder
    await db.commit()
