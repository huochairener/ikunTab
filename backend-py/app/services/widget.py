from __future__ import annotations
"""组件业务。"""
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..exceptions import BizException
from ..models import Widget
from ..schemas.widget import WidgetSaveIn, WidgetLayoutItem


async def list_widgets(db: AsyncSession, uid: int, group_id: int) -> List[Widget]:
    res = await db.execute(
        select(Widget)
        .where(Widget.user_id == uid, Widget.group_id == group_id)
        .order_by(Widget.sort_order.asc())
    )
    return list(res.scalars())


async def save_widget(db: AsyncSession, uid: int, dto: WidgetSaveIn) -> Widget:
    if dto.id:
        w = await db.get(Widget, dto.id)
        if w is None or w.user_id != uid:
            raise BizException("组件不存在", 404)
        w.type = dto.type
        w.name = dto.name
        w.rows = dto.rows if dto.rows is not None else 1
        w.cols = dto.cols if dto.cols is not None else 1
        w.config = dto.config
        if dto.enabled is not None:
            w.enabled = dto.enabled
        if dto.sortOrder is not None:
            w.sort_order = dto.sortOrder
        if dto.x is not None:
            w.x = dto.x
        if dto.y is not None:
            w.y = dto.y
        await db.commit()
        await db.refresh(w)
        return w
    # 新建
    res = await db.execute(
        select(Widget).where(Widget.user_id == uid, Widget.group_id == dto.groupId)
    )
    existing = list(res.scalars())
    max_sort = max((w.sort_order for w in existing), default=-1)
    new_rows = dto.rows if dto.rows is not None else 1
    # 新组件默认追加到布局末尾
    max_y = max(
        ((w.y or 0) + (w.rows or 1) for w in existing),
        default=0,
    )
    w = Widget(
        user_id=uid,
        group_id=dto.groupId,
        type=dto.type,
        name=dto.name,
        rows=new_rows,
        cols=dto.cols if dto.cols is not None else 1,
        config=dto.config,
        enabled=dto.enabled if dto.enabled is not None else 1,
        sort_order=dto.sortOrder if dto.sortOrder is not None else (max_sort + 1),
        x=dto.x if dto.x is not None else 0,
        y=dto.y if dto.y is not None else max_y,
    )
    db.add(w)
    await db.commit()
    await db.refresh(w)
    return w


async def delete_widget(db: AsyncSession, uid: int, wid: int) -> None:
    w = await db.get(Widget, wid)
    if w is None or w.user_id != uid:
        return
    await db.delete(w)
    await db.commit()


async def layout_widgets(db: AsyncSession, uid: int, items: List[WidgetLayoutItem]) -> None:
    for it in items:
        w = await db.get(Widget, it.id)
        if w is None or w.user_id != uid:
            continue
        if it.sortOrder is not None:
            w.sort_order = it.sortOrder
        if it.x is not None:
            w.x = it.x
        if it.y is not None:
            w.y = it.y
        if it.cols is not None:
            w.cols = it.cols
        if it.rows is not None:
            w.rows = it.rows
    await db.commit()
