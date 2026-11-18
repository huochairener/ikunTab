#!/usr/bin/env bash
# 一键推送主站数据到 ESA 备用站。等价于 `node scripts/push.mjs`。
# 用法：
#   ./push.sh              # 推送到 pages/.env 里配置的备用站
#   ./push.sh --dry-run    # 只检查配置和数据库连通性，不真正推送
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "❌ 未找到 node，请先安装 Node.js 20+" >&2
  exit 1
fi

exec node scripts/push.mjs "$@"
