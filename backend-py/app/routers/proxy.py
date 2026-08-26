from __future__ import annotations
"""/api/favicon /api/weather /api/hotlist 代理路由（无需登录）。"""
from typing import Optional

from fastapi import APIRouter, Query

from ..response import ok
from ..services import proxy as proxy_svc

router = APIRouter(prefix="/api", tags=["proxy"])


@router.get("/favicon")
async def favicon(url: str = Query(...)):
    target = await proxy_svc.favicon(url)
    return ok({"url": target})


@router.get("/weather")
async def weather(
    city: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
):
    return ok(await proxy_svc.weather(city, lat, lon))


@router.get("/hotlist")
async def hotlist(source: str = Query("weibo")):
    return ok(await proxy_svc.hotlist(source))
