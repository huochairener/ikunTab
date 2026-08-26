from __future__ import annotations
"""统一响应 R<T>，与前端 http.ts 拦截器协议一致。"""
from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class R(BaseModel, Generic[T]):
    code: int = 0
    msg: str = "ok"
    data: Optional[T] = None


def ok(data: Any = None) -> dict:
    return {"code": 0, "msg": "ok", "data": data}


def fail(msg: str, code: int = 500) -> dict:
    return {"code": code, "msg": msg, "data": None}
