from __future__ import annotations
"""第三方代理：favicon / 天气 / 热榜，含内存 TTL 缓存。"""
import asyncio
import time
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlparse

import httpx
import orjson

from ..config import get_settings

settings = get_settings()

# 进程内 TTL 缓存：(expire_ts, value)
_cache: Dict[str, Tuple[float, Any]] = {}
_cache_lock = asyncio.Lock()


async def _cache_get(key: str):
    async with _cache_lock:
        item = _cache.get(key)
        if item is None:
            return None
        expire, value = item
        if expire < time.time():
            _cache.pop(key, None)
            return None
        return value


async def _cache_set(key: str, value: Any, ttl: int) -> None:
    if value is None:
        return
    async with _cache_lock:
        _cache[key] = (time.time() + ttl, value)


def _extract_domain(url: str) -> Optional[str]:
    if not url:
        return None
    s = url if "://" in url else f"http://{url}"
    try:
        host = urlparse(s).hostname
    except Exception:
        return None
    if not host:
        return None
    return host[4:] if host.startswith("www.") else host


async def favicon(url: str) -> Optional[str]:
    domain = _extract_domain(url)
    if not domain:
        return None
    key = f"favicon::{domain}"
    cached = await _cache_get(key)
    if cached is not None:
        return cached
    result = f"https://icon.horse/icon/{domain}"
    await _cache_set(key, result, settings.favicon_cache_days * 86400)
    return result


_WMO_CODE_DESC = [
    (0, "晴"),
    (3, "多云"),
    (48, "雾"),
    (57, "毛毛雨"),
    (67, "雨"),
    (77, "雪"),
    (82, "阵雨"),
    (86, "阵雪"),
    (95, "雷阵雨"),
    (999, "未知"),
]


def _wmo_desc(code: int) -> str:
    for hi, txt in _WMO_CODE_DESC:
        if code <= hi:
            return txt
    return "未知"


async def weather(city: Optional[str], lat: Optional[float], lon: Optional[float]) -> Optional[str]:
    cache_key = f"weather::{city or ''}::{lat}::{lon}"
    cached = await _cache_get(cache_key)
    if cached is not None:
        return cached
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resolved_city = None
            if (lat is None or lon is None) and city:
                r = await client.get(
                    "https://geocoding-api.open-meteo.com/v1/search",
                    params={"name": city, "count": 1, "language": "zh"},
                )
                node = orjson.loads(r.content)
                results = node.get("results") or []
                if results:
                    lat = results[0].get("latitude")
                    lon = results[0].get("longitude")
                    resolved_city = results[0].get("name")
            if lat is None or lon is None:
                return None
            r = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
                    "timezone": "auto",
                    "forecast_days": 1,
                },
            )
            data = orjson.loads(r.content)
            cur = data.get("current") or {}
            code = int(cur.get("weather_code") or 0)
            payload = {
                "city": resolved_city,
                "temperature": cur.get("temperature_2m"),
                "description": _wmo_desc(code),
                "humidity": cur.get("relative_humidity_2m"),
                "wind": cur.get("wind_speed_10m"),
            }
            out = orjson.dumps(payload).decode()
            await _cache_set(cache_key, out, settings.weather_cache_minutes * 60)
            return out
    except Exception:
        return None


_HOTLIST_TYPE_MAP = {
    "weibo": "weibo",
    "douyin": "douyin",
    "bilibili": "bilibili",
    "toutiao": "toutiao",
    "zhihu": "zhihu",
    "baidu": "baidu",
}


async def hotlist(source: str) -> str:
    cache_key = f"hotlist::{source}"
    cached = await _cache_get(cache_key)
    if cached is not None:
        return cached
    t = _HOTLIST_TYPE_MAP.get(source, "weibo")
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(f"{settings.hotlist_api_url.rstrip('/')}/{t}")
            body = r.text
            if not body or body.lstrip().startswith("<"):
                return "[]"
            node = orjson.loads(body)
            data = node.get("data") or []
            out = []
            for i, it in enumerate(data, start=1):
                out.append(
                    {
                        "title": it.get("title", ""),
                        "hot": str(it.get("hot", "")),
                        "url": it.get("url") or it.get("mobileUrl", ""),
                        "index": i,
                    }
                )
            payload = orjson.dumps(out).decode()
            if payload != "[]":
                await _cache_set(cache_key, payload, settings.hotlist_cache_minutes * 60)
            return payload
    except Exception:
        return "[]"
