from __future__ import annotations
"""认证业务：注册、登录、当前用户。"""
from typing import Optional

from fastapi import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..exceptions import BizException
from ..models import User
from ..security import create_token, hash_password, verify_password

settings = get_settings()


def _to_me(u: User) -> dict:
    return {"id": u.id, "username": u.username, "email": u.email, "avatar": u.avatar}


async def register(db: AsyncSession, *, username: str, password: str, email: Optional[str]) -> dict:
    exists = await db.scalar(select(User.id).where(User.username == username))
    if exists:
        raise BizException("用户名已存在", 400)
    u = User(username=username, password=hash_password(password), email=email)
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return _to_me(u)


async def login(db: AsyncSession, *, username: str, password: str, response: Response) -> dict:
    res = await db.execute(select(User).where(User.username == username))
    u: Optional[User] = res.scalar_one_or_none()
    if u is None or not verify_password(password, u.password):
        raise BizException("用户名或密码错误", 401)
    token = create_token(u.id)
    response.set_cookie(
        key=settings.jwt_cookie_name,
        value=token,
        max_age=60 * settings.jwt_expire_minutes,
        path="/",
        httponly=True,
        samesite="lax",
        secure=False,
    )
    return _to_me(u)


async def me(db: AsyncSession, uid: Optional[int]) -> Optional[dict]:
    if uid is None:
        return None
    u = await db.get(User, uid)
    return _to_me(u) if u else None


async def logout(response: Response) -> None:
    response.delete_cookie(settings.jwt_cookie_name, path="/")
