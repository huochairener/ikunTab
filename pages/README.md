# ikun-tab 备用站（ESA 函数和 Pages）

主站（Docker + FastAPI + MySQL）的备用站点，部署到阿里云 **ESA（边缘安全加速）的「函数和 Pages」** 上：

- **前端**：复用仓库 `frontend/` 的 Vue SPA 源码，构建产物静态托管在 ESA 边缘节点（`esa.jsonc` 已配置 SPA 路由兜底）。
- **后端**：`src/` 下用 Web 标准 API 重写了 Python 主站的全部接口（同一批 `tab_*` 表、同一套 `R<T>` 响应格式、同一套 JWT Cookie 登录态），并支持把 `/api/*` 请求转发给 Python 主站。
- **登录才能使用**：与主站一致的 JWT httpOnly Cookie + `pwd_version` 校验，未登录接口返回 `code=401`，前端自动跳登录页。

## 两种数据来源（重点，先读这段）

ESA 边缘函数是 **V8 Isolate 运行时，没有 TCP 能力**（官方 API 只有 fetch / KV / Cache 等，无 `net`/`tls`），所以 **在 ESA 上无法用 mysql2 直连你的 MySQL**。代码里因此设计了两种模式，由 `IKUN_DATA_SOURCE` 控制：

| 模式 | 取值 | 说明 | 适用环境 |
|------|------|------|----------|
| 转发主站 | `proxy` | `/api/*` 原样转发给 Python 主站，由主站读写数据库、校验登录 | **ESA 边缘函数（推荐）** |
| 直连数据库 | `direct` | 备用站自己用 mysql2 读写 MySQL、自己签发/校验 JWT | 任何标准 Node.js 运行时（本地 dev-server、自建 Node 主机等） |
| 自动 | `auto`（默认） | 配了 MySQL 就直连；没配、或当前运行时加载不了 mysql2（边缘函数）、或数据库连不上时，自动转发主站 | 两种都覆盖 |

> **ESA 部署的实际效果**：边缘函数上 mysql2 加载失败 → 自动落到 proxy 模式。当“用户 → 主站”的网络路径不稳而“用户 → ESA → 主站”的路径正常时，备用站可用；**主站整机宕机时 ESA 上的备用站也无法出数据**（边缘节点连不到你的 MySQL）。若需要“主站宕机也能用”，需把同一份 `src/` 代码跑在支持 TCP 的 Node 运行时上（本目录 `npm run dev` 即是；或云函数/函数计算类产品），配置 `IKUN_MYSQL_*` 直连数据库即可。

直连与转发模式 **共用同一个数据库、同一套表结构**，登录态互通（见下方 JWT 配置）。

## 目录结构

```
pages/
├── esa.jsonc              # ESA Pages 配置（入口 / 静态资源目录 / SPA 兜底 / 构建命令）
├── package.json           # mysql2 + bcryptjs（均为纯 JS，Node 与边缘函数都能带）
├── .env.example           # 环境变量样例（本地开发用）
├── src/                   # 后端（Web 标准 API，无框架依赖）
│   ├── index.js           # 入口：export default { fetch(request, context, env) }
│   ├── app.js             # 请求分发：代理 / 直连 / 异常兜底
│   ├── config.js          # 环境变量（IKUN_ 前缀，与 Python 主站同名同义）
│   ├── db.js              # mysql2 连接池（动态加载；边缘函数上加载失败自动转代理）
│   ├── jwt.js             # HS256 JWT，与 Python PyJWT 完全互通（sub/iat/exp/pv）
│   ├── password.js        # bcryptjs，哈希与 Python passlib(bcrypt) 完全兼容
│   ├── upstream.js         # 主站转发（/api/*、/uploads/*）
│   └── routes/            # auth / bookmarks / groups / widgets / settings / search-engines / proxy / upload
├── scripts/
│   ├── build.mjs          # ESA 构建命令：构建 ../frontend 并输出到 pages/dist
│   ├── dev-server.mjs     # 本地开发服务器（静态 + API 同源，读 .env）
│   ├── check.mjs          # 冒烟测试（无需数据库）
│   ├── integration-test.mjs # 端到端集成测试（需要真实 MySQL 测试库）
│   └── schema.sql         # 表结构（与 backend-py/app/models 完全一致；主站已建表则无需执行）
└── dist/                  # 构建产物（git 忽略，ESA 构建时生成）
```

## 部署到 ESA（GitHub 导入方式）

1. **推送到 GitHub**：整个 `ikun-tab` 仓库（含本目录）推到你的 GitHub 仓库。
2. **ESA 控制台** → 边缘计算和 AI → 函数和Pages → 创建 → **导入 GitHub 仓库**：
   - **根目录**：填 `/pages`
   - 构建命令 / 安装命令 / 静态资源目录 / 函数入口：**留空**，由仓库里的 `pages/esa.jsonc` 自动接管（`esa.jsonc` 优先级高于控制台配置）。
3. **配置函数变量**（项目详情 → 基本信息 → 函数变量，生产环境）：

   | 变量 | 必填 | 值 |
   |------|------|------|
   | `IKUN_API_ORIGIN` | ✅ | Python 主站完整地址（如 `https://ikun.example.com`），结尾不带 `/` |
   | `IKUN_JWT_SECRET` | 建议 | 与主站一致的 JWT 密钥（docker-compose 部署时取其 `JWT_SECRET` 环境变量值）。ESA 纯代理模式下可以不配；一旦涉及直连模式（auto/direct），必须一致，否则主站签发的登录态在备用站无效 |
   | `IKUN_HOTLIST_API_URL` | 可选 | 热榜聚合服务地址（与主站一致） |
   | `IKUN_UPLOAD_ORIGIN` | 可选 | 上传回源地址，默认同 `IKUN_API_ORIGIN` |

4. **域名**：ESA 会分配一个 `*.esa.aliyun.com` 的临时预览域名（有效期 60 分钟，仅供验证）。长期使用请绑定自定义域名（需该域名已接入 ESA 并激活）。也可以先直接用分配域名访问验证功能。

> 也可以用 CLI 部署：`npm i -g esa-cli && esa-cli login && cd pages && esa-cli deploy`（CLI 部署时 `esa.jsonc` 的 `entry`/`assets` 生效，`installCommand`/`buildCommand` 仅控制台导入时使用，本地先 `npm run build` 生成 `dist/`）。

## 本地开发

```bash
cd pages
cp .env.example .env        # 按需填写
npm install
npm run dev                 # http://127.0.0.1:18080（静态 + API 同源）
```

- 本地默认同源部署，无需 CORS 配置。
- `IKUN_DATA_SOURCE=direct` + `IKUN_MYSQL_*` 指向本地/远程 MySQL 时，走与主站相同的直连逻辑（同一数据库，登录态与主站互通，前提是 `IKUN_JWT_SECRET` 与主站一致）。

## 测试

```bash
npm run check              # 冒烟测试（无需数据库）：路由 / JWT / 鉴权 / 404 / favicon / 代理模式配置校验

# 端到端集成测试（真实 MySQL，务必指向测试库！）
mysql -h 127.0.0.1 -u root -p -e "CREATE DATABASE ikuntab_pages_test DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -h 127.0.0.1 -u root -p ikuntab_pages_test < scripts/schema.sql
IKUN_MYSQL_HOST=127.0.0.1 IKUN_MYSQL_USER=root IKUN_MYSQL_PASSWORD=*** IKUN_MYSQL_DB=ikuntab_pages_test \
  node scripts/integration-test.mjs
```

集成测试覆盖：注册/登录/改密（含 `pwd_version` 使旧 token 失效）/分组/书签（含文件夹级联删除、移动排序）/小组件（`rows` 保留字）/设置（透明度夹取）/搜索引擎（默认引擎唯一）/越权访问 404 等 40 项。

## 与 Python 主站的一致性说明

- **表结构**：`scripts/schema.sql` 与 `backend-py/app/models/*.py` 逐列一致（主站已建表则无需执行）。
- **响应格式**：`{ code, msg, data }`，`code=0` 成功；业务错误 HTTP 200 + 非 0 `code`；未登录 `code=401` —— 前端拦截器行为完全一致。
- **JWT**：`HS256`，payload `{ sub: 用户id, iat, exp, pv: 密码版本号 }`，与 Python `PyJWT` 互通（同密钥时 token 互相可验）。
- **密码**：bcrypt `$2b$` 哈希，与 Python `passlib(bcrypt)` 互通（互相能验对方创建的账号）。
- **接口路径/参数/校验**：与 `backend-py/app/routers` 逐一对应（如 `/api/bookmarks/move`、`parentId=0` 移出文件夹、文件夹删除级联子项、新组件追加到栅格末尾等行为均保持一致）。
- **上传**：ESA 边缘没有持久磁盘，`/api/upload` 与 `/uploads/*` 一律转发主站（`IKUN_UPLOAD_ORIGIN`，默认 `IKUN_API_ORIGIN`）。

## 已知差异 / 限制

- ESA 边缘函数 CPU 时间配额约 100ms/次：代理模式不受影响（登录等重活都在主站完成）；**直连模式含 bcrypt 哈希（注册/登录/改密）在边缘函数上既无 TCP 也会超 CPU，所以直连模式只面向 Node 运行时**。
- ESA 免费版边缘函数单次执行最多 4 个子请求：本项目每请求最多 1~2 个 fetch，满足限制。
- Python 端对非法参数（长度越界等）由 pydantic 返回 422，本端返回 `code=400` 的 `R<T>`；前端两种都按“请求失败”处理，无实际影响。
