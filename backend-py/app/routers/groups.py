from __future__ import annotations
"""/api/groups 路由。"""
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import require_user_id
from ..response import ok
from ..schemas.group import GroupOut, GroupSaveIn, GroupSortItem
from ..services import group as group_svc

router = APIRouter(prefix="/api/groups", tags=["groups"])


@router.get("")
async def list_groups(
    uid: int = Depends(require_user_id), db: AsyncSession = Depends(get_db)
):
    rows = await group_svc.list_groups(db, uid)
    return ok([GroupOut.from_orm_row(g).model_dump() for g in rows])


@router.post("")
async def save_group(
    dto: GroupSaveIn,
    uid: int = Depends(require_user_id),
    db: AsyncSession = Depends(get_db),
):
    g = await group_svc.save_group(db, uid, dto)
    return ok(GroupOut.from_orm_row(g).model_dump())


@router.put("/{gid}")
async def update_group(
    gid: int,
    dto: GroupSaveIn,
    uid: int = Depends(require_user_id),
    db: AsyncSession = Depends(get_db),
):
    dto.id = gid
    g = await group_svc.save_group(db, uid, dto)
    return ok(GroupOut.from_orm_row(g).model_dump())


@router.delete("/{gid}")
async def delete_group(
    gid: int,
    uid: int = Depends(require_user_id),
    db: AsyncSession = Depends(get_db),
):
    await group_svc.delete_group(db, uid, gid)
    return ok()


@router.put("/sort")
async def sort_groups(
    items: List[GroupSortItem],
    uid: int = Depends(require_user_id),
    db: AsyncSession = Depends(get_db),
):
    await group_svc.sort_groups(db, uid, items)
    return ok()
