from __future__ import annotations
"""FastAPI 应用入口。"""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text

from .config import get_settings
from .database import AsyncSessionLocal, Base, engine
from .exceptions import BizException
from .response import fail
from .routers import (
    auth as auth_router,
    bookmarks as bm_router,
    groups as grp_router,
    proxy as proxy_router,
    search_engines as se_router,
    settings as settings_router,
    upload as upload_router,
    widgets as widget_router,
)
from .seed import run_seed

settings = get_settings()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s | %(message)s",
)
log = logging.getLogger("ikun-tab")

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

SPA_ROUTES = ("/", "/login", "/register", "/newtab", "/settings")


async def _init_schema() -> None:
    """启动时建表：表不存在则用 SQLAlchemy 元数据 create_all。失败不阻塞应用启动。"""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            # 轻量迁移：为老库补全新增列（如缺少 transition_animation）
            # MySQL 5.7 / 部分版本不支持 ADD COLUMN IF NOT EXISTS，需先查 information_schema
            def _ensure_columns(sync_conn):
                insp = inspect(sync_conn)
                existing = {c["name"] for c in insp.get_columns("tab_user_setting")}
                if "transition_animation" not in existing:
                    sync_conn.execute(
                        text(
                            "ALTER TABLE tab_user_setting "
                            "ADD COLUMN transition_animation VARCHAR(16) NOT NULL DEFAULT 'flip'"
                        )
                    )
                if "primary_color" not in existing:
                    sync_conn.execute(
                        text(
                            "ALTER TABLE tab_user_setting "
                            "ADD COLUMN primary_color VARCHAR(16) NULL"
                        )
                    )
                if "ui_opacity" not in existing:
                    sync_conn.execute(
                        text(
                            "ALTER TABLE tab_user_setting "
                            "ADD COLUMN ui_opacity INT NOT NULL DEFAULT 100"
                        )
                    )
                if "bg_overlay_opacity" not in existing:
                    sync_conn.execute(
                        text(
                            "ALTER TABLE tab_user_setting "
                            "ADD COLUMN bg_overlay_opacity INT NOT NULL DEFAULT 100"
                        )
                    )
            await conn.run_sync(_ensure_columns)
        log.info("schema: 表结构已就绪")
    except Exception as e:
        log.warning("schema: 初始化失败（%s），应用仍继续启动，等待 DB 就绪后由首次请求触发重试", e)


async def _run_seed_if_needed() -> None:
    try:
        async with AsyncSessionLocal() as db:
            await run_seed(db)
    except Exception:
        log.exception("seed 失败，跳过")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # 调度后台任务，等 DB 可用后再建表
    import asyncio
    bg = asyncio.create_task(_init_schema())
    yield
    bg.cancel()
    try:
        await bg
    except (asyncio.CancelledError, Exception):
        pass
    await engine.dispose()


app = FastAPI(
    title="ikun-tab",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(BizException)
async def biz_exception_handler(_: Request, exc: BizException):
    return JSONResponse(status_code=200, content=fail(exc.msg, exc.code))


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception):
    msg = str(exc)
    if "Can't connect to MySQL" in msg or "Connection refused" in msg or "OperationalError" in msg:
        log.error("DB 不可用：%s", exc)
        return JSONResponse(status_code=200, content=fail("数据库暂不可用，请稍后重试", 503))
    log.exception("unhandled error: %s", exc)
    return JSONResponse(status_code=200, content=fail(f"系统异常：{exc}", 500))


# 业务路由
app.include_router(auth_router.router)
app.include_router(grp_router.router)
app.include_router(bm_router.router)
app.include_router(widget_router.router)
app.include_router(settings_router.router)
app.include_router(se_router.router)
app.include_router(upload_router.router)
app.include_router(proxy_router.router)


# 上传目录静态托管
_upload_dir = settings.upload_dir
os.makedirs(_upload_dir, exist_ok=True)
app.mount(settings.upload_url_prefix, StaticFiles(directory=_upload_dir), name="uploads")


# 前端静态资源（SPA）
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/favicon.ico", include_in_schema=False)
    async def _favicon():
        f = STATIC_DIR / "favicon.ico"
        return FileResponse(f) if f.exists() else JSONResponse(status_code=404, content={"detail": "not found"})

    @app.get("/favicon.svg", include_in_schema=False)
    async def _favicon_svg():
        f = STATIC_DIR / "favicon.svg"
        return FileResponse(f, media_type="image/svg+xml") if f.exists() else JSONResponse(status_code=404, content={"detail": "not found"})

    @app.get("/vite.svg", include_in_schema=False)
    async def _vite_svg():
        f = STATIC_DIR / "vite.svg"
        return FileResponse(f) if f.exists() else JSONResponse(status_code=404, content={"detail": "not found"})

    async def _spa_fallback(_request: Request):
        idx = STATIC_DIR / "index.html"
        return FileResponse(idx) if idx.exists() else JSONResponse(
            status_code=404, content={"detail": "frontend not built"}
        )

    for _path in SPA_ROUTES:
        app.add_route(_path, _spa_fallback, methods=["GET"], include_in_schema=False)
