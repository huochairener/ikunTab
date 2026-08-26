from __future__ import annotations
"""/api/upload 路由。"""
from fastapi import APIRouter, Depends, UploadFile, File

from ..deps import require_user_id
from ..response import ok
from ..services import upload as upload_svc

router = APIRouter(prefix="/api/upload", tags=["upload"])


@router.post("")
async def upload(
    file: UploadFile = File(...),
    _uid: int = Depends(require_user_id),
):
    url = await upload_svc.save_upload(file)
    return ok({"url": url})
