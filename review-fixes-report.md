# 后端审查问题修复报告

## 概述

针对 7 项审查结果逐条核实，全部属实，其中 6 项已完成修复并通过验证；第 8 项（数据库迁移）经确认暂不上 Alembic，保留现状。

## 修复明细

### 1+5. 进程内缓存无上限 + 全局锁串行化（`app/services/proxy.py`）

- 手写 `_cache` 字典（只增不删、读写全抢一把 `asyncio.Lock`）整体移除。
- 换成 `cachetools.TTLCache`：`_weather_cache`（maxsize=256）、`_hotlist_cache`（maxsize=64），LRU + TTL 双重淘汰，内存有硬上限。
- 读路径改为无锁原子访问（单事件循环内 get/set 之间无 await），高并发下缓存不再是瓶颈。
- favicon 的无意义缓存删除（存的是写死的 icon.horse 直链，浏览器直连，缓存纯属浪费）；`favicon_cache_days` 配置项同步移除。
- `requirements.txt` 新增 `cachetools==5.3.3`。

### 2. bcrypt 阻塞事件循环（`app/services/auth.py`）

- 注册、登录、改密码共 4 处同步 bcrypt 调用（每次约 100ms）改为 `await asyncio.to_thread(...)` 丢线程池，并发登录不再卡死整个 worker。
- `security.py` 保持同步函数不变，改动集中在调用点。

### 4. 鉴权每请求多一次 DB 查询（`app/deps.py`）

- 新增 `_token_cache: TTLCache[str, int](maxsize=4096, ttl=60)`，token → uid 校验结果缓存 60 秒，命中时免去主键回源查询。
- 代价：改密码后其他设备最长延迟 60s 掉线（当前设备拿到新 token 字符串，首验回源，不受影响），已在注释中说明。

### 6. 未处理异常返回 HTTP 200（`app/main.py`）

- DB 不可用分支：200 → **503**；其他未处理异常：200 → **500**。网关、监控、前端错误分支恢复正常感知。
- 不再把 `str(exc)` 直接返回给客户端（内部细节只进日志），响应体保持 R<T> 结构。
- 业务错误 `BizException` 保持 200 + code 约定，与前端 axios 拦截器解包逻辑兼容。

### 7. CORS 通配 + 凭证（`app/config.py`、`app/main.py`）

- 默认 `cors_origins` 从 `*` 收敛为 `http://localhost:5173,http://127.0.0.1:5173`（Vite 开发服务器）。
- 显式配置 `*` 时强制 `allow_credentials=False` 并输出 warning——通配与凭证同开等于任意网站可带 cookie 调 API。
- 生产同源部署（Nginx 反代）无需配置 CORS；README.md / README.en.md 的环境变量示例已同步更新。

### 8. create_all + 手写 ALTER → Alembic（未执行）

- 经确认暂不上 Alembic，保留现状（当前仅 2 张表的补列逻辑，且有失败不阻塞启动的兜底）。schema 复杂后再引入。

## 验证结果

1. **编译检查**：py_compile 全部改动文件通过。
2. **行为断言**：7 项全过——TTLCache 容量/LRU 淘汰、favicon 无缓存写入、bcrypt to_thread 加解密等价、token 缓存参数、CORS 默认来源与通配强制关凭证、异常处理器状态码。
3. **启动冒烟**（本机无 MySQL，恰好验证降级行为）：
   - `POST /api/auth/login`（DB 不可用）→ **HTTP 503** + `{"code":503,...}`
   - `GET /api/auth/me`（未登录）→ HTTP 200 `{"code":0,...}`
   - CORS 预检：`http://localhost:5173` 放行（含 `allow-credentials: true`）；恶意来源无 `allow-origin` 头，正确拒绝。

## 备注

- 本机为 Python 3.13，无法安装 pinned 老依赖（SQLAlchemy 2.0.30 等无 cp313 wheel），验证用的是兼容版本；生产 Dockerfile 为 python:3.12-alpine，pinned 版本不受影响，无需改 requirements。
- 修改文件清单：`backend-py/app/services/proxy.py`、`app/services/auth.py`、`app/deps.py`、`app/main.py`、`app/config.py`、`backend-py/requirements.txt`、`README.md`、`README.en.md`。
