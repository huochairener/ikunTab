from __future__ import annotations
"""FastAPI 依赖：当前用户、数据库会话。"""
from typing import Optional

from fastapi import Cookie, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .database import get_db
from .exceptions import BizException
from .models import User
from .security import parse_token

settings = get_settings()


async def current_user_id(
    request: Request,
    token_cookie: Optional[str] = Cookie(default=None, alias=settings.jwt_cookie_name),
    db: AsyncSession = Depends(get_db),
) -> Optional[int]:
    """优先从 cookie 取，缺失则尝试 Authorization: Bearer。

    token 里的 pv 必须与库中 pwd_version 一致，否则视为已吊销（改过密码）。
    """
    token = token_cookie
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        return None
    parsed = parse_token(token)
    if parsed is None:
        return None
    uid, pv = parsed
    u = await db.get(User, uid)
    if u is None or u.pwd_version != pv:
        return None
    return uid


async def require_user_id(
    uid: Optional[int] = Depends(current_user_id),
) -> int:
    if uid is None:
        raise BizException("未登录", 401)
    return uid
