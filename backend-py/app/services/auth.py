from __future__ import annotations
"""认证业务：注册、登录、当前用户。"""
import logging
from typing import Optional

from fastapi import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..exceptions import BizException
from ..models import User
from ..security import create_token, hash_password, verify_password

settings = get_settings()
log = logging.getLogger(__name__)


def _to_me(u: User) -> dict:
    return {"id": u.id, "username": u.username, "email": u.email, "avatar": u.avatar}


def _set_token_cookie(response: Response, u: User) -> None:
    response.set_cookie(
        key=settings.jwt_cookie_name,
        value=create_token(u.id, u.pwd_version),
        max_age=60 * settings.jwt_expire_minutes,
        path="/",
        httponly=True,
        samesite="lax",
        secure=False,
    )


# bcrypt 只取密码的前 72 字节，超出部分 passlib 直接抛错，这里提前给出可读提示
def _check_password(raw: str) -> None:
    if len(raw) < 6:
        raise BizException("密码至少 6 位", 400)
    if len(raw.encode("utf-8")) > 72:
        raise BizException("密码过长，UTF-8 编码后不能超过 72 字节（bcrypt 上限）", 400)


async def register(db: AsyncSession, *, username: str, password: str, email: Optional[str]) -> dict:
    exists = await db.scalar(select(User.id).where(User.username == username))
    if exists:
        raise BizException("用户名已存在", 400)
    _check_password(password)
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
    _set_token_cookie(response, u)
    return _to_me(u)


async def change_password(
    db: AsyncSession, uid: int, *, old_password: str, new_password: str, response: Response
) -> None:
    u = await db.get(User, uid)
    if u is None:
        raise BizException("未登录", 401)
    if not verify_password(old_password, u.password):
        raise BizException("当前密码不正确", 400)
    _check_password(new_password)
    u.password = hash_password(new_password)
    # 版本号 +1 使其他设备上已签发的 token 立刻失效
    u.pwd_version = (u.pwd_version or 0) + 1
    await db.commit()
    log.info("password changed: uid=%s username=%s pwd_version=%s", uid, u.username, u.pwd_version)
    # 当前设备换上新 token，否则会跟着一起掉线
    _set_token_cookie(response, u)


async def me(db: AsyncSession, uid: Optional[int]) -> Optional[dict]:
    if uid is None:
        return None
    u = await db.get(User, uid)
    return _to_me(u) if u else None


async def logout(response: Response) -> None:
    response.delete_cookie(settings.jwt_cookie_name, path="/")
