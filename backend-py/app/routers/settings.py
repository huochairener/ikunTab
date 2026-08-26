from __future__ import annotations
"""/api/settings 路由。"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import require_user_id
from ..response import ok
from ..schemas.settings import SettingsIn, SettingsOut
from ..services import settings as settings_svc

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("")
async def get(
    uid: int = Depends(require_user_id),
    db: AsyncSession = Depends(get_db),
):
    s = await settings_svc.get_settings(db, uid)
    return ok(SettingsOut.from_orm_row(s).model_dump())


@router.put("")
async def update(
    dto: SettingsIn,
    uid: int = Depends(require_user_id),
    db: AsyncSession = Depends(get_db),
):
    s = await settings_svc.update_settings(db, uid, dto)
    return ok(SettingsOut.from_orm_row(s).model_dump())
