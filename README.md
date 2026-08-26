

# ikun-tab

一个美观实用的浏览器标签首页应用，支持个性化定制、小组件插件、书签分组管理等功能。可自托管，单实例多用户。

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
IKUN_CORS_ORIGINS=*
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
