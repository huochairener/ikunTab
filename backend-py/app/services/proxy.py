from __future__ import annotations
"""第三方代理：favicon / 天气 / 热榜，含进程内 TTL 缓存。"""
from typing import Optional
from urllib.parse import urlparse

import httpx
import orjson
from cachetools import TTLCache

from ..config import get_settings

settings = get_settings()

# cachetools.TTLCache：LRU + TTL 双重淘汰，容量有上限，键不会无限增长。
# 单事件循环内 get/set 之间没有 await，同步操作天然原子，无需加锁；
# 只有跨 await 的"检查-写入"才有并发问题，而重复回源一次代价可接受。
_weather_cache = TTLCache(maxsize=256, ttl=settings.weather_cache_minutes * 60)
_hotlist_cache = TTLCache(maxsize=64, ttl=settings.hotlist_cache_minutes * 60)


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
    """返回第三方 icon 服务的直链，由浏览器直接加载，无需服务端缓存。"""
    domain = _extract_domain(url)
    if not domain:
        return None
    return f"https://icon.horse/icon/{domain}"


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
    cache_key = f"{city or ''}::{lat}::{lon}"
    cached = _weather_cache.get(cache_key)
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
            _weather_cache[cache_key] = out
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
    cache_key = source
    cached = _hotlist_cache.get(cache_key)
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
                _hotlist_cache[cache_key] = payload
            return payload
    except Exception:
        return "[]"
