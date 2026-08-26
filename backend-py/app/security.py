from __future__ import annotations
"""JWT 与密码工具。"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from passlib.context import CryptContext

from .config import get_settings

settings = get_settings()
_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(raw: str) -> str:
    return _pwd_ctx.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return _pwd_ctx.verify(raw, hashed)
    except Exception:
        return False


def create_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": str(user_id), "iat": int(now.timestamp()), "exp": int(exp.timestamp())}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def parse_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return int(payload["sub"])
    except Exception:
        return None
