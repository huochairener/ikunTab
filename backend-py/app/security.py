from __future__ import annotations
"""JWT 与密码工具。"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from passlib.context import CryptContext

from .config import get_settings

settings = get_settings()
log = logging.getLogger(__name__)
_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(raw: str) -> str:
    return _pwd_ctx.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return _pwd_ctx.verify(raw, hashed)
    except Exception:
        # 哈希本身有问题（ident 不认识 / 被截断 / 列宽不足）时也会被当成"密码错误"，
        # 这里把特征打进日志：正常 bcrypt 是 60 字符、以 $2b$ 或 $2a$ 开头。
        log.exception(
            "bcrypt 校验失败，按密码错误处理：len=%s prefix=%r",
            len(hashed or ""), (hashed or "")[:7],
        )
        return False


def create_token(user_id: int, pwd_version: int) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "pv": int(pwd_version),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def parse_token(token: str) -> Optional[tuple[int, int]]:
    """返回 (user_id, pwd_version)；pv 缺失（改动前签发的 token）按无效处理。"""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        if "pv" not in payload:
            return None
        return int(payload["sub"]), int(payload["pv"])
    except Exception:
        return None
