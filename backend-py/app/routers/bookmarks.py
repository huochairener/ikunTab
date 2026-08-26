from __future__ import annotations
"""/api/bookmarks 路由。"""
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import require_user_id
from ..response import ok
from ..schemas.bookmark import BookmarkMoveIn, BookmarkOut, BookmarkSaveIn, BookmarkSortItem
from ..services import bookmark as bm_svc

router = APIRouter(prefix="/api/bookmarks", tags=["bookmarks"])


@router.get("")
async def list_bookmarks(
    groupId: int = Query(..., description="分组 id"),
    uid: int = Depends(require_user_id),
    db: AsyncSession = Depends(get_db),
):
    rows = await bm_svc.list_bookmarks(db, uid, groupId)
    return ok([BookmarkOut.from_orm_row(b).model_dump() for b in rows])


@router.post("")
async def save_bookmark(
    dto: BookmarkSaveIn,
    uid: int = Depends(require_user_id),
    db: AsyncSession = Depends(get_db),
):
    b = await bm_svc.save_bookmark(db, uid, dto)
    return ok(BookmarkOut.from_orm_row(b).model_dump())


@router.put("/move")
async def move_bookmark(
    dto: BookmarkMoveIn,
    uid: int = Depends(require_user_id),
    db: AsyncSession = Depends(get_db),
):
    await bm_svc.move_bookmark(db, uid, dto)
    return ok()


@router.put("/sort")
async def sort_bookmarks(
    items: List[BookmarkSortItem],
    uid: int = Depends(require_user_id),
    db: AsyncSession = Depends(get_db),
):
    await bm_svc.sort_bookmarks(db, uid, items)
    return ok()


@router.put("/{bid}")
async def update_bookmark(
    bid: int,
    dto: BookmarkSaveIn,
    uid: int = Depends(require_user_id),
    db: AsyncSession = Depends(get_db),
):
    dto.id = bid
    b = await bm_svc.save_bookmark(db, uid, dto)
    return ok(BookmarkOut.from_orm_row(b).model_dump())


@router.delete("/{bid}")
async def delete_bookmark(
    bid: int,
    uid: int = Depends(require_user_id),
    db: AsyncSession = Depends(get_db),
):
    await bm_svc.delete_bookmark(db, uid, bid)
    return ok()
