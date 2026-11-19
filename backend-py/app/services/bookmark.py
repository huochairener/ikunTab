from __future__ import annotations
"""书签业务。"""
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..exceptions import BizException
from ..models import Bookmark, Group
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

    new_group_id = dto.groupId if dto.groupId is not None else b.group_id
    if new_group_id != b.group_id:
        await _move_cross_group(db, uid, b, new_group_id, dto)
        return

    # 同分组内移动
    # 0 或 None 视为顶层
    b.parent_id = dto.parentId if (dto.parentId and dto.parentId > 0) else None
    if dto.sortOrder is not None:
        b.sort_order = dto.sortOrder
    await db.commit()


async def _move_cross_group(
    db: AsyncSession, uid: int, b: Bookmark, new_group_id: int, dto: BookmarkMoveIn
) -> None:
    """跨分组移动：校验目标分组归属，并将文件夹（含全部后代）级联迁移。"""
    # 目标分组必须存在且属于当前用户
    g = await db.get(Group, new_group_id)
    if g is None or g.user_id != uid:
        raise BizException("目标分组不存在", 404)
    # 不允许移动到自己内部（防御）
    if b.type == 1 and dto.parentId and dto.parentId > 0 and dto.parentId == b.id:
        raise BizException("不能移动到自身内部", 400)

    old_group_id = b.group_id
    b.group_id = new_group_id
    # 跨分组移动固定落到目标分组顶层
    b.parent_id = None

    # 文件夹：递归迁移全部后代子项（子项保留原有层级关系，仅切换分组）
    if b.type == 1:
        res = await db.execute(
            select(Bookmark).where(
                Bookmark.user_id == uid,
                Bookmark.group_id == old_group_id,
            )
        )
        # 以 parent_id 建立索引，逐层向下迁移
        by_parent: dict[int, list[Bookmark]] = {}
        for row in res.scalars():
            if row.parent_id is not None:
                by_parent.setdefault(row.parent_id, []).append(row)
        stack = [b.id]
        while stack:
            pid = stack.pop()
            for child in by_parent.get(pid, []):
                child.group_id = new_group_id
                if child.type == 1:
                    stack.append(child.id)

    if dto.sortOrder is not None:
        b.sort_order = dto.sortOrder
    else:
        # 未指定顺序时追加到目标分组顶层末尾
        res = await db.execute(
            select(Bookmark).where(
                Bookmark.user_id == uid,
                Bookmark.group_id == new_group_id,
                Bookmark.parent_id.is_(None),
            )
        )
        siblings = list(res.scalars())
        max_sort = max((s.sort_order for s in siblings), default=-1)
        b.sort_order = max_sort + 1

    await db.commit()


async def sort_bookmarks(db: AsyncSession, uid: int, items: List[BookmarkSortItem]) -> None:
    for it in items:
        b = await db.get(Bookmark, it.id)
        if b is None or b.user_id != uid:
            continue
        b.parent_id = it.parentId if (it.parentId and it.parentId > 0) else None
        b.sort_order = it.sortOrder
    await db.commit()
