from __future__ import annotations
"""/api/search-engines 路由。"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import require_user_id
from ..response import ok
from ..schemas.search_engine import EngineOut, EngineSaveIn
from ..services import search_engine as engine_svc

router = APIRouter(prefix="/api/search-engines", tags=["search-engines"])


@router.get("")
async def list_engines(
    uid: int = Depends(require_user_id),
    db: AsyncSession = Depends(get_db),
):
    rows = await engine_svc.list_engines(db, uid)
    return ok([EngineOut.from_orm_row(e).model_dump() for e in rows])


@router.post("")
async def save_engine(
    dto: EngineSaveIn,
    uid: int = Depends(require_user_id),
    db: AsyncSession = Depends(get_db),
):
    e = await engine_svc.save_engine(db, uid, dto)
    return ok(EngineOut.from_orm_row(e).model_dump())


@router.put("/{eid}")
async def update_engine(
    eid: int,
    dto: EngineSaveIn,
    uid: int = Depends(require_user_id),
    db: AsyncSession = Depends(get_db),
):
    dto.id = eid
    e = await engine_svc.save_engine(db, uid, dto)
    return ok(EngineOut.from_orm_row(e).model_dump())


@router.delete("/{eid}")
async def delete_engine(
    eid: int,
    uid: int = Depends(require_user_id),
    db: AsyncSession = Depends(get_db),
):
    await engine_svc.delete_engine(db, uid, eid)
    return ok()
