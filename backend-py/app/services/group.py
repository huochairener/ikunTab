from __future__ import annotations
"""分组业务。"""
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..exceptions import BizException
from ..models import Group
from ..schemas.group import GroupSaveIn, GroupSortItem


async def list_groups(db: AsyncSession, uid: int) -> List[Group]:
    res = await db.execute(
        select(Group).where(Group.user_id == uid).order_by(Group.sort_order.asc())
    )
    return list(res.scalars())


async def save_group(db: AsyncSession, uid: int, dto: GroupSaveIn) -> Group:
    if dto.id:
        g = await db.get(Group, dto.id)
        if g is None or g.user_id != uid:
            raise BizException("分组不存在", 404)
        g.name = dto.name
        g.icon = dto.icon if dto.icon is not None else g.icon
        await db.commit()
        await db.refresh(g)
        return g
    # 新建
    res = await db.execute(select(Group).where(Group.user_id == uid))
    existing = list(res.scalars())
    max_sort = max((g.sort_order for g in existing), default=-1)
    g = Group(
        user_id=uid,
        name=dto.name,
        icon=dto.icon or "🌟",
        sort_order=max_sort + 1,
    )
    db.add(g)
    await db.commit()
    await db.refresh(g)
    return g


async def delete_group(db: AsyncSession, uid: int, gid: int) -> None:
    g = await db.get(Group, gid)
    if g is None or g.user_id != uid:
        return
    await db.delete(g)
    await db.commit()


async def sort_groups(db: AsyncSession, uid: int, items: List[GroupSortItem]) -> None:
    for it in items:
        g = await db.get(Group, it.id)
        if g is None or g.user_id != uid:
            continue
        g.sort_order = it.sortOrder
    await db.commit()
