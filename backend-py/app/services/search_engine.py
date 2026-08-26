from __future__ import annotations
"""搜索引擎业务。"""
from typing import List, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..exceptions import BizException
from ..models import SearchEngine
from ..schemas.search_engine import EngineSaveIn


async def list_engines(db: AsyncSession, uid: int) -> List[SearchEngine]:
    res = await db.execute(
        select(SearchEngine)
        .where(SearchEngine.user_id == uid)
        .order_by(SearchEngine.is_default.desc())
    )
    return list(res.scalars())


async def save_engine(db: AsyncSession, uid: int, dto: EngineSaveIn) -> SearchEngine:
    if dto.id:
        e = await db.get(SearchEngine, dto.id)
        if e is None or e.user_id != uid:
            raise BizException("搜索引擎不存在", 404)
        e.name = dto.name
        e.url_template = dto.urlTemplate
        e.icon = dto.icon
        await db.commit()
        await db.refresh(e)
        if dto.isDefault == 1:
            await _mark_default(db, uid, e.id)
            await db.refresh(e)
        return e
    e = SearchEngine(
        user_id=uid,
        name=dto.name,
        url_template=dto.urlTemplate,
        icon=dto.icon,
        is_default=dto.isDefault or 0,
    )
    db.add(e)
    await db.commit()
    await db.refresh(e)
    if e.is_default == 1:
        await _mark_default(db, uid, e.id)
        await db.refresh(e)
    return e


async def delete_engine(db: AsyncSession, uid: int, eid: int) -> None:
    e = await db.get(SearchEngine, eid)
    if e is None or e.user_id != uid:
        return
    await db.delete(e)
    await db.commit()


async def _mark_default(db: AsyncSession, uid: int, eid: int) -> None:
    # 同一用户其它引擎全部置为非默认
    await db.execute(
        update(SearchEngine)
        .where(SearchEngine.user_id == uid, SearchEngine.id != eid)
        .values(is_default=0)
    )
    await db.execute(
        update(SearchEngine)
        .where(SearchEngine.id == eid)
        .values(is_default=1)
    )
    await db.commit()
