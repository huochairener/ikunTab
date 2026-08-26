# Multi-stage build for ikun-tab (Python FastAPI)
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# Stage 2: Install Python deps
FROM python:3.12-alpine AS deps

WORKDIR /app

# 仅安装 bcrypt 等需要的系统依赖；alpine 已自带 libffi / openssl
RUN apk add --no-cache libffi openssl

COPY backend-py/requirements.txt ./
# 优先 wheels，避免本地编译耗时
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# Stage 3: Runtime
FROM python:3.12-alpine

WORKDIR /app

RUN apk add --no-cache libffi openssl curl tini && \
    addgroup -S app && adduser -S app -G app

# 复制已安装的 Python 包
COPY --from=deps /install /usr/local

# 复制后端代码
COPY backend-py/app ./app

# 复制前端构建产物（由 frontend-builder 产出到 frontend/dist/）
COPY --from=frontend-builder /app/frontend/dist ./static

# 上传目录
RUN mkdir -p /app/uploads && chown -R app:app /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    IKUN_UPLOAD_DIR=/app/uploads

USER app

EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8090/api/auth/me || exit 1

# 单 worker，uvicorn async 已经扛得住中等并发；如需更高吞吐改 --workers N
# 内存约束：单 worker ~80MB，比原 Spring Boot ~280MB 节省 200MB
ENTRYPOINT ["tini", "--"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090", \
     "--workers", "1", \
     "--loop", "uvloop", \
     "--http", "httptools", \
     "--no-access-log", \
     "--proxy-headers"]
