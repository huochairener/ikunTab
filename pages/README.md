# ikun-tab 备用站（ESA 函数和 Pages）

主站（Docker + FastAPI + MySQL）的**容灾备用站**，部署到阿里云 **ESA（边缘安全加速）的「函数和Pages」**。

> **目标**：主站整机宕机时，仍能通过备用站**登录**并**找回目的书签**。

## 架构：KV 只读镜像（默认）

```
主站 MySQL ──(定时全量推送 /api/sync)──> ESA KV 快照 ──> 备用站边缘函数 ──> 浏览器
                                              (只读)
```

- **只读**：备用站不能新增/修改/删除任何书签、分组、设置；写操作统一返回 `403`。
- **单向**：数据只从主站流向备用站，绝不反向。
- **主站宕机仍可用**：备用站的数据来自 KV，不依赖主站存活。
- **不实现挂件**：`GET /api/widgets` 返回空数组。

## 为什么必须用 KV（不能直连 MySQL、也不能代理）

| 方案 | 主站宕机时 | 可行性 |
|------|-----------|--------|
| 边缘函数 + MySQL 直连 | 可用 | ❌ **物理不可能**：ESA 边缘是 V8 Isolate，无 TCP，`mysql2` 加载失败 |
| 边缘函数 + 代理主站 | ❌ 全站不可用 | 能跑，但本质上只是「换个入口访问主站」，没有任何容灾价值 |
| 边缘函数 + **KV 快照** | ✅ 可用 | ✅ 唯一满足目标且能留在 ESA 的方案 |

## 登录为什么用轻量哈希（重要）

ESA 边缘函数 **CPU 配额只有 100ms/次**。bcrypt（rounds=10）一次要数百 ms，在边缘上必然超配额——所以备用站**不能**用主站的 bcrypt 哈希校验密码。

解决方案：备用站用 `sha256(salt + ":" + 明文密码)` 校验，Web Crypto 原生实现，微秒级。

代价与权衡（已知并接受）：
- `sha256+盐` 抗离线暴力破解弱于 bcrypt。该站**单人使用**，且仅用于主站宕机时的降级登录，风险可接受。
- **bcrypt 哈希无法逆推明文**，所以同步脚本必须提供一次明文密码（`IKUN_MIRROR_PASSWORD`）才能算出备用站的哈希。盐由 `IKUN_SYNC_SECRET` 稳定派生，不需额外存储。
- JWT 仍用 `IKUN_JWT_SECRET` 签发（HS256），与主站同一密钥时登录态互通。

## 部署步骤

### 1. 构建与部署

推送到 Git 仓库后，在 ESA 控制台导入，**根目录填 `/pages`**，其余留空（由 `esa.jsonc` 接管）。

### 2. 控制台创建 KV 命名空间并绑定

ESA 控制台 → 项目 → 基本信息 → **函数变量 / 绑定**：

| 类型 | 变量名 | 值 |
|------|--------|-----|
| **KV 绑定** | `IKUN_KV` | 选择你创建的 KV 命名空间 |
| 变量 | `IKUN_SYNC_SECRET` | 随机长字符串（与推送脚本一致） |
| 变量 | `IKUN_JWT_SECRET` | 与主站 `JWT_SECRET` 一致（登录态互通） |
| 变量 | `IKUN_API_ORIGIN` | 主站地址，仅用于 `/uploads/*` 背景图回源 |

> `IKUN_DATA_SOURCE` 默认就是 `mirror`，可不配。

### 3. 配置（只需一次）

```bash
cd pages
npm install
cp .env.example .env
```

然后编辑 `pages/.env`，填好这几项（其余留空即可）：

| 变量 | 说明 |
|------|------|
| `IKUN_SYNC_URL` | 备用站地址，如 `https://ikuntab.glare.work` |
| `IKUN_SYNC_SECRET` | 与 ESA 控制台函数变量一致 |
| `IKUN_MIRROR_USERNAME` | 你的主站账号名 |
| `IKUN_MIRROR_PASSWORD` | 你的主站登录密码（仅本地算哈希，不上传） |
| `IKUN_MYSQL_HOST` / `USER` / `PASSWORD` / `DB` | 主站数据库连接 |

> `pages/.env` 已在 `.gitignore` 中，不会提交到仓库。

### 4. 推送数据（一条命令）

```bash
cd pages
npm run push      # 或 ./push.sh
```

输出示例：

```
[push] 目标：https://ikuntab.glare.work
[push] 账号：zmq
[push] 读取到：用户 1 / 分组 2 / 书签 47 / 设置 1 / 引擎 1
[sync] 推送成功：{"code":0,...}
```

先验证配置是否正确（只检查配置和数据库，不真正推送）：

```bash
npm run push:dry    # 或 ./push.sh --dry-run
```

### 5. 定时同步（推荐每小时）

配置好 `.env` 之后，cron 只需要一行，不用重复写环境变量：

```cron
0 * * * * cd /path/to/ikun-tab/pages && ./push.sh >> /var/log/ikun-push.log 2>&1
```

`push.sh` 会自动读取同目录的 `.env`。

## 接口清单（镜像模式）

| 方法 | 路径 | 行为 |
|------|------|------|
| POST | `/api/sync` | 主站推送（共享密钥鉴权），全量覆盖 KV 快照 |
| POST | `/api/auth/login` | 用 KV 里的轻量哈希校验，签发 JWT Cookie |
| GET | `/api/auth/me` | 当前用户 |
| POST | `/api/auth/logout` | 清 Cookie |
| GET | `/api/groups` | 读分组 |
| GET | `/api/bookmarks?groupId=N` | 读书签 |
| GET | `/api/settings` | 读设置 |
| GET | `/api/search-engines` | 读搜索引擎 |
| GET | `/api/widgets` | 固定返回 `[]`（备用站不实现挂件） |
| GET | `/api/favicon` `/api/weather` `/api/hotlist` | 无状态第三方代理，照常可用 |
| **其他写操作** | `/api/**` (POST/PUT/DELETE) | 统一 `403 备用站为只读镜像，请到主站操作` |

## 本地开发与测试

```bash
cd pages
npm install
npm run test:mirror   # 镜像模式端到端测试（内存 KV，无需 MySQL/ESA）：39 项
npm run check         # 冒烟测试：11 项
npm run dev           # http://127.0.0.1:18080（dev-server 内置内存 KV）
```

## 其它模式（排障用，非容灾）

`IKUN_DATA_SOURCE` 还可取 `auto` / `direct` / `proxy`：

- `auto`：配了 MySQL 就直连，否则回退代理
- `direct`：只用 MySQL（需要支持 TCP 的 Node 运行时，非 ESA 边缘）
- `proxy`：只用主站代理——**主站宕机即不可用**，仅用于临时排障

## 已知限制

- ESA 边缘函数 CPU 配额 ~100ms、单请求最多 4 个子请求：镜像模式每请求只读 1 次 KV，完全满足。
- `/uploads/*`（背景图/头像）仍回源主站，主站宕机时返回 404。
- KV 快照是**全量覆盖**写入：数据量小（单人使用，几十条书签）时最简单且不会半新半旧。
- 主站新增数据后，需等下一次定时推送才会出现在备用站。
