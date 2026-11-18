

# ikun-tab

一个美观实用的浏览器标签首页应用，支持个性化定制、小组件插件、书签分组管理等功能。可自托管，单实例多用户。

此外还附带一个部署在阿里云 **ESA（边缘安全加速）函数和 Pages** 上的**容灾备用站**：主站整机宕机时，依然能登录并找回书签。详见 [🛟 备用站](#-备用站容灾主站宕机仍可用)。

## ✨ 功能特性

### 📑 书签管理
- **分组管理**：创建多个书签分组，通过轨道式 Dock 快速切换
- **文件夹支持**：支持将书签拖拽成文件夹，归类整理
- **智能排序**：自定义书签排序，重要内容置顶显示
- **拖拽操作**：支持书签拖拽移动、合并、移出文件夹等交互

### 🔍 搜索功能
- **多引擎支持**：内置多种搜索引擎，可自定义添加
- **快捷切换**：快速切换默认搜索引擎
- **直达搜索**：输入关键词直达搜索结果

### 🧩 小组件系统
- **日历**：查看日期、星期、可翻月
- **时钟**：显示实时时间（12/24 小时制）
- **倒计时**：设置目标日期倒计时
- **热搜榜**：聚合各平台热门榜单（微博、抖音、B站、知乎等）
- **天气**：基于定位或自定义城市
- **自定义面板**：通过 iframe 嵌入任意网址

### 🎨 个性化设置
- **主题切换**：日间 / 夜间 / 跟随系统
- **背景定制**：必应每日图 / 随机图 / 上传图片
- **动画效果**：可开关背景浮动动效
- **窗口模式**：设置书签打开方式（新标签页 / 当前页）

### 🔐 用户系统
- **账户注册**：用户名 + 密码注册
- **安全登录**：JWT 存 httpOnly Cookie，开新标签免重复登录
- **数据持久化**：登录后自动同步所有配置

### 🛟 容灾备用站
- **主站宕机可用**：书签数据镜像在边缘存储（EdgeKV），不依赖主站存活
- **登录态互通**：与主站共用 JWT 密钥，同一账号密码登入
- **只读安全**：写操作统一拒绝，数据只从主站单向流入
- **一键同步**：`npm run push` 把主站数据推送到边缘，支持 cron 定时

## 🛠 技术栈

### 前端
- **Vue 3** + **TypeScript** - 渐进式框架 + 类型安全
- **Vite** - 下一代前端构建工具
- **Pinia** - Vue 状态管理
- **Vue Router** - 官方路由管理
- **TailwindCSS** - 原子化 CSS 框架
- **Axios** - HTTP 客户端

### 后端
- **Python 3.12** - 编程语言
- **FastAPI** - 异步 Web 框架
- **Uvicorn**（uvloop + httptools）- ASGI 服务器
- **SQLAlchemy 2.0 (async)** + **aiomysql** - 异步 ORM 与 MySQL 驱动
- **Pydantic v2** + **pydantic-settings** - 数据校验与配置
- **PyJWT** + **passlib[bcrypt]** - JWT 与密码哈希
- **httpx** / **orjson** - 外部代理与高性能 JSON

### 数据存储
- **MySQL 8** - 关系型数据库
- **进程内 TTL 缓存** - 热榜 / 天气 / favicon 缓存（无需 Redis，降低内存占用）

### 备用站
- **阿里云 ESA 函数和 Pages** - 边缘函数（V8 Isolate）+ 静态站点托管
- **EdgeKV 边缘存储** - 只读快照镜像，单值 1.8MB 上限自动分片
- **Web 标准 API** - Fetch / Web Crypto 自实现 JWT、路由与全部接口
- **纯 ESM JavaScript** - 无打包依赖，复用主站前端 SPA 产物
- **mysql2** - 仅推送脚本（Node 侧）读取主站数据时使用

### 部署
- **Docker** + **Docker Compose** - 一键容器化部署（MySQL + 应用）

> 单 worker 运行内存约 80MB，相比早期 Java Spring Boot 版本（约 280MB）显著降低。

## 📂 项目结构

```
ikun-tab/
├── frontend/                 # Vue3 前端项目
│   ├── src/
│   │   ├── api/             # API 接口封装（axios + R<T> 拦截）
│   │   ├── components/       # Vue 组件
│   │   │   ├── widgets/      # 小组件（热榜/天气/时钟/日历/倒计时/自定义）
│   │   │   └── ...
│   │   ├── composables/      # 组合式函数
│   │   ├── pages/            # 页面组件
│   │   ├── router/           # 路由配置
│   │   ├── store/            # Pinia 状态管理
│   │   ├── utils/            # 工具函数（书签图标 / 栅格布局）
│   │   └── style.css         # 全局样式
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── backend-py/               # Python FastAPI 后端项目
│   ├── app/
│   │   ├── main.py           # 应用入口（lifespan / CORS / 异常处理 / 静态托管）
│   │   ├── config.py         # 环境变量配置（IKUN_ 前缀）
│   │   ├── database.py       # 异步 SQLAlchemy 引擎与会话
│   │   ├── deps.py           # 依赖：当前用户 / 数据库会话
│   │   ├── security.py       # JWT 与 bcrypt
│   │   ├── response.py       # 统一响应 R<T>
│   │   ├── exceptions.py     # 业务异常
│   │   ├── seed.py           # 演示数据注入
│   │   ├── models/           # SQLAlchemy 模型（tab_*）
│   │   ├── schemas/          # Pydantic 请求 / 响应模型
│   │   ├── routers/          # 路由（auth/bookmarks/groups/proxy/...）
│   │   └── services/         # 业务逻辑层
│   ├── requirements.txt
│   └── .dockerignore
│
├── pages/                    # 备用站（ESA 函数和 Pages，KV 只读镜像）
│   ├── src/
│   │   ├── index.js          # 边缘函数入口（fetch(request, ctx, env)）
│   │   ├── app.js            # 路由分发与统一 R<T> 响应
│   │   ├── config.js         # 环境变量解析（IKUN_ 前缀，与主站一致）
│   │   ├── kv.js             # EdgeKV 读写 + 快照自动分片
│   │   ├── mirror.js         # 镜像快照读取
│   │   ├── auth-mirror.js    # 轻量哈希校验 + JWT 签发
│   │   ├── jwt.js / http.js  # Web Crypto JWT / 请求响应工具
│   │   └── routes*/          # 各接口实现（含 routes/sync.js 推送入口）
│   ├── scripts/
│   │   ├── build.mjs         # 复用 ../frontend 构建 SPA 到 dist/
│   │   ├── push.mjs          # 一键推送（读取 pages/.env）
│   │   ├── sync-push.mjs     # 主站 MySQL → /api/sync 全量推送
│   │   ├── mirror-test.mjs   # 镜像模式端到端测试（45 项）
│   │   ├── check.mjs         # 冒烟测试（11 项）
│   │   └── dev-server.mjs    # 本地开发服务器（内存 KV）
│   ├── push.sh               # push.mjs 的 shell 包装（cron 友好）
│   ├── esa.jsonc             # ESA 部署配置
│   ├── .env.example          # 备用站配置模板
│   └── README.md             # 备用站详细文档
│
├── .trae/documents/         # 产品文档
│   ├── PRD.md              # 产品需求文档
│   └── TechnicalArchitecture.md
│
├── Dockerfile               # 多阶段构建（前端 + Python）
├── docker-compose.yml       # Docker 编排（MySQL + 应用）
└── README.md
```

## 🚀 快速开始

### 环境要求

- Node.js 18+
- Python 3.12+
- MySQL 8.0+

### 后端配置

1. 创建数据库：
```sql
CREATE DATABASE ikuntab DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. 安装依赖：
```bash
cd backend-py
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements.txt
```

3. 配置环境变量（在 `backend-py/` 下创建 `.env`，或直接导出环境变量）。所有配置项以 `IKUN_` 为前缀：
```ini
IKUN_ENV=dev
IKUN_MYSQL_HOST=127.0.0.1
IKUN_MYSQL_PORT=3306
IKUN_MYSQL_DB=ikuntab
IKUN_MYSQL_USER=root
IKUN_MYSQL_PASSWORD=your_password
IKUN_JWT_SECRET=your_long_random_jwt_secret
IKUN_JWT_COOKIE_NAME=ikun_token
IKUN_UPLOAD_DIR=/tmp/ikun-uploads
# CORS 允许的来源（逗号分隔；默认含本地开发来源，生产同源部署无需配置；设为 * 将强制关闭凭证）
IKUN_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
# 热榜聚合服务地址（可选，默认 http://localhost:3000）
IKUN_HOTLIST_API_URL=http://localhost:3000
```

4. 启动后端服务：
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8090 --reload
```

> 表结构在应用启动时由 SQLAlchemy `Base.metadata.create_all` 自动创建；首次启动会自动注入演示账号 **demo / demo123456**，无需手动导入 SQL。

### 前端配置

1. 安装依赖：
```bash
cd frontend
npm install
```

2. 启动开发服务器（已配置 `/api` 与 `/uploads` 代理到 `localhost:8090`）：
```bash
npm run dev
```

3. 构建生产版本（产物输出到 `dist/`）：
```bash
npm run build
```

> 生产部署时，`Dockerfile` 会自动构建前端并拷贝到 `backend-py/static/`，由 FastAPI 托管。

### Docker 部署

使用 Docker Compose 一键部署（MySQL + 应用）：
```bash
docker-compose up -d
```

启动后访问 `http://localhost:8090`。可用 `demo / demo123456` 登录体验。

## 🛟 备用站（容灾：主站宕机仍可用）

主站跑在 Docker + FastAPI + MySQL 上，一旦宿主机故障就整体不可用。备用站部署在**阿里云 ESA 的函数和 Pages** 上，用同一份前端 SPA + 边缘函数实现全部接口，数据来自**边缘存储 EdgeKV 的只读快照**——主站宕机时照常登录、照常看书签。

```
主站 MySQL ──(npm run push，定时全量推送 POST /api/sync)──> ESA EdgeKV ──> 备用站边缘函数 ──> 浏览器
                                                             (只读快照)
```

**为什么不能直连数据库**：ESA 边缘函数运行在 V8 Isolate 里，**没有 TCP**，`mysql2` 加载即失败；如果只是把请求代理回主站，主站一挂备用站也跟着挂，没有任何容灾价值。因此唯一可行方案是「KV 快照 + 主站单向推送」。

### 备用站能做什么

| 能力 | 说明 |
|------|------|
| 登录 / 登出 / 当前用户 | 独立校验，签发 JWT Cookie（与主站同密钥时登录态互通） |
| 浏览分组与书签 | 与主站一致的界面与交互 |
| 读取设置 / 搜索引擎 | 主题、背景、默认引擎等配置原样呈现 |
| 网站图标 / 天气 / 热搜 | 无状态第三方代理，边缘直接出网 |

### 备用站不能做什么

- **一切写操作**（增删改书签、分组、设置、注册、改密）统一返回 `403 备用站为只读镜像，请到主站操作`
- **不实现小组件**：`GET /api/widgets` 固定返回 `[]`
- **`/uploads/*`**（背景图、头像等）回源主站，主站宕机时返回 404
- 主站新增数据后，需等下一次推送才出现在备用站

### 部署（三步）

**1. 部署到 ESA**：推送到 Git 仓库后，在 ESA 控制台导入项目，**根目录填 `/pages`**，其余留空（由 `esa.jsonc` 接管，自动跑 `npm run build` 复用 `frontend/` 源码构建 SPA）。

**2. 创建边缘存储 + 配置函数变量**：ESA 控制台 → 边缘计算 → **边缘存储** 创建空间，然后在项目 → 函数变量中添加：

| 变量名 | 值 |
|--------|-----|
| `IKUN_KV_NAMESPACE` | 刚创建的存储空间名称（**区分大小写**） |
| `IKUN_SYNC_SECRET` | 随机长字符串，与推送脚本一致 |
| `IKUN_JWT_SECRET` | 与主站 `IKUN_JWT_SECRET` 一致（登录态互通） |
| `IKUN_API_ORIGIN` | 主站地址，仅用于 `/uploads/*` 回源 |

> ESA 是通过**环境变量**指定存储空间名（代码里 `new EdgeKV({ namespace })`），不是把 KV 绑定成句柄；改完变量必须**重新部署**才生效。`IKUN_DATA_SOURCE` 默认即 `mirror`，可不配。

**3. 推送数据**：

```bash
cd pages
npm install
cp .env.example .env   # 填 IKUN_SYNC_URL / IKUN_SYNC_SECRET / IKUN_MIRROR_USERNAME / IKUN_MIRROR_PASSWORD / IKUN_MYSQL_*
npm run push           # 一条命令推送；./push.sh 等价
npm run push:dry       # 只校验配置与数据库连通性，不真正推送
```

输出示例：
```
[push] 目标：https://ikuntab.glare.work
[push] 账号：zmq
[push] 读取到：用户 1 / 分组 2 / 书签 47 / 设置 1 / 引擎 1
[sync] 推送成功：{"code":0,...}
```

定时同步（推荐每小时，`push.sh` 会自动读取同目录 `.env`）：

```cron
0 * * * * cd /path/to/ikun-tab/pages && ./push.sh >> /var/log/ikun-push.log 2>&1
```

> `pages/.env` 已在 `.gitignore` 中，不会入库。

### 备用站接口

| 方法 | 路径 | 行为 |
|------|------|------|
| POST | `/api/sync` | 主站推送（共享密钥鉴权），全量覆盖 KV 快照 |
| POST | `/api/auth/login` | 用 KV 中的轻量哈希校验，签发 JWT Cookie |
| GET | `/api/auth/me` | 当前用户 |
| POST | `/api/auth/logout` | 清除 Cookie |
| GET | `/api/groups` `/api/bookmarks` `/api/settings` `/api/search-engines` | 读快照 |
| GET | `/api/widgets` | 固定返回 `[]` |
| GET | `/api/favicon` `/api/weather` `/api/hotlist` | 第三方代理，照常可用 |

### 设计取舍（已知并接受）

- **登录用 `sha256(salt + ':' + 明文)` 而非 bcrypt**：ESA 边缘函数 CPU 配额仅 ~100ms/次，bcrypt（rounds=10）要数百 ms 必然超时。代价是抗离线暴力破解弱于 bcrypt，该站为单人降级入口，风险可接受。盐由 `IKUN_SYNC_SECRET` 稳定派生。
- **同步脚本需提供一次明文密码**（`IKUN_MIRROR_PASSWORD`）：主站库里只有 bcrypt 哈希，无法逆推明文，所以由推送脚本本地算出备用站哈希，明文不上传、不入 KV。优点是**不改主站表结构、不改主站代码**。
- **EdgeKV 单值上限 1.8MB**：快照自动分片为 `ikun_manifest`（提交点）+ `ikun_chunk_0..N`（每片 ≤ 1.5MB），按 UTF-8 字节切分不破坏中文；先写分片再写 manifest，不会出现半新半旧，缩小快照时自动清理旧分片。
- **单请求最多 4 个子请求**：镜像模式每请求读 1 个 manifest + 若干分片，正常数据量 1~2 次即可。

> 细节文档、排障模式（`auto` / `direct` / `proxy`）、EdgeKV 限制应对见 [`pages/README.md`](pages/README.md)。

## 📡 API 接口

统一响应格式 `R<T>`：`{ "code": 0, "msg": "ok", "data": T }`，`code !== 0` 表示业务错误。

### 认证模块
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/login` | POST | 用户登录（下发 httpOnly Cookie） |
| `/api/auth/logout` | POST | 退出登录 |
| `/api/auth/me` | GET | 获取当前用户信息 |

### 书签模块
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/bookmarks` | GET | 获取书签列表（?groupId=） |
| `/api/bookmarks` | POST | 新建书签 / 文件夹 |
| `/api/bookmarks/{id}` | PUT | 更新书签 |
| `/api/bookmarks/{id}` | DELETE | 删除书签 |
| `/api/bookmarks/move` | PUT | 移动 / 排序书签 |

### 分组模块
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/groups` | GET | 获取分组列表 |
| `/api/groups` | POST | 创建分组 |
| `/api/groups/{id}` | PUT | 更新分组 |
| `/api/groups/{id}` | DELETE | 删除分组 |
| `/api/groups/sort` | PUT | 分组排序 |

### 小组件模块
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/widgets` | GET | 获取组件列表（?groupId=） |
| `/api/widgets` | POST | 新建组件 |
| `/api/widgets/{id}` | PUT | 更新组件 |
| `/api/widgets/{id}` | DELETE | 删除组件 |
| `/api/widgets/move` | PUT | 组件移动 / 布局 |

### 搜索引擎模块
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/search-engines` | GET | 获取搜索引擎列表 |
| `/api/search-engines` | POST | 新建搜索引擎 |
| `/api/search-engines/{id}` | PUT | 更新搜索引擎 |
| `/api/search-engines/{id}` | DELETE | 删除搜索引擎 |

### 代理模块
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/favicon` | GET | 获取网站图标（?url=） |
| `/api/weather` | GET | 获取天气信息（?city=&lat=&lon=） |
| `/api/hotlist` | GET | 获取热搜榜单（?source=） |

### 设置 / 上传模块
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/settings` | GET | 获取用户设置 |
| `/api/settings` | PUT | 更新用户设置 |
| `/api/upload` | POST | 上传图片（书签图标 / 壁纸） |

## 📝 License

本项目基于 MIT License 开源。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来帮助改进项目。
