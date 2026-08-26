from __future__ import annotations
"""上传文件业务。"""
import os
import uuid

from fastapi import UploadFile

from ..config import get_settings
from ..exceptions import BizException

settings = get_settings()

UPLOAD_DIR = settings.upload_dir
URL_PREFIX = settings.upload_url_prefix


async def save_upload(file: UploadFile) -> str:
    if file is None:
        raise BizException("文件为空")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    original = file.filename or ""
    ext = ""
    if "." in original:
        ext = original[original.rfind("."):]
    name = uuid.uuid4().hex + ext
    dest = os.path.join(UPLOAD_DIR, name)
    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)
    return f"{URL_PREFIX}/{name}"
