from __future__ import annotations
"""/api/widgets 路由。"""
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import require_user_id
from ..response import ok
from ..schemas.widget import WidgetLayoutItem, WidgetOut, WidgetSaveIn
from ..services import widget as widget_svc

router = APIRouter(prefix="/api/widgets", tags=["widgets"])


@router.get("")
async def list_widgets(
    groupId: int = Query(...),
    uid: int = Depends(require_user_id),
    db: AsyncSession = Depends(get_db),
):
    rows = await widget_svc.list_widgets(db, uid, groupId)
    return ok([WidgetOut.from_orm_row(w).model_dump() for w in rows])


@router.post("")
async def save_widget(
    dto: WidgetSaveIn,
    uid: int = Depends(require_user_id),
    db: AsyncSession = Depends(get_db),
):
    w = await widget_svc.save_widget(db, uid, dto)
    return ok(WidgetOut.from_orm_row(w).model_dump())


@router.put("/{wid}")
async def update_widget(
    wid: int,
    dto: WidgetSaveIn,
    uid: int = Depends(require_user_id),
    db: AsyncSession = Depends(get_db),
):
    dto.id = wid
    w = await widget_svc.save_widget(db, uid, dto)
    return ok(WidgetOut.from_orm_row(w).model_dump())


@router.delete("/{wid}")
async def delete_widget(
    wid: int,
    uid: int = Depends(require_user_id),
    db: AsyncSession = Depends(get_db),
):
    await widget_svc.delete_widget(db, uid, wid)
    return ok()


@router.put("/move")
async def layout_widgets(
    items: List[WidgetLayoutItem],
    uid: int = Depends(require_user_id),
    db: AsyncSession = Depends(get_db),
):
    await widget_svc.layout_widgets(db, uid, items)
    return ok()
