from __future__ import annotations
"""/api/auth 路由。"""
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import current_user_id
from ..response import ok
from ..schemas.auth import LoginIn, RegisterIn
from ..services import auth as auth_svc

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register")
async def register(dto: RegisterIn, db: AsyncSession = Depends(get_db)):
    user = await auth_svc.register(
        db, username=dto.username, password=dto.password, email=dto.email
    )
    return ok(user)


@router.post("/login")
async def login(dto: LoginIn, response: Response, db: AsyncSession = Depends(get_db)):
    user = await auth_svc.login(
        db, username=dto.username, password=dto.password, response=response
    )
    return ok(user)


@router.post("/logout")
async def logout(response: Response):
    await auth_svc.logout(response)
    return ok()


@router.get("/me")
async def me(uid: int | None = Depends(current_user_id), db: AsyncSession = Depends(get_db)):
    return ok(await auth_svc.me(db, uid))
