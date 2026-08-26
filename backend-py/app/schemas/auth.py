from __future__ import annotations
"""认证模块的请求/响应模型。"""
from typing import Optional

from pydantic import BaseModel, Field


class RegisterIn(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)
    email: Optional[str] = Field(default=None, max_length=128)


class LoginIn(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    avatar: Optional[str] = None
