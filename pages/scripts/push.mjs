#!/usr/bin/env node
// 一键推送：把主站数据推送到 ESA 备用站（只读镜像）。
//
// 用法（在 pages 目录下）：
//   node scripts/push.mjs              # 读取 pages/.env
//   node scripts/push.mjs --dry-run    # 只校验配置和数据库，不真正推送
//   IKUN_MYSQL_PASSWORD=xxx node scripts/push.mjs   # 临时覆盖某一项
//
// 首次使用：
//   cp .env.example .env   然后填好 IKUN_SYNC_URL / IKUN_SYNC_SECRET /
//   IKUN_MIRROR_USERNAME / IKUN_MIRROR_PASSWORD / IKUN_MYSQL_*
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main as push } from './sync-push.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const pagesDir = resolve(here, '..');
const envFile = join(pagesDir, '.env');

/** 极简 .env 解析（不引入 dotenv 依赖）；已存在的环境变量优先 */
function loadEnvFile(file) {
  if (!existsSync(file)) return false;
  for (const line of readFileSync(file, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
  return true;
}

const REQUIRED = [
  ['IKUN_SYNC_URL', '备用站地址，如 https://ikuntab.glare.work'],
  ['IKUN_SYNC_SECRET', '与 ESA 控制台函数变量一致'],
  ['IKUN_MIRROR_USERNAME', '备用站登录账号（与主站一致）'],
  ['IKUN_MIRROR_PASSWORD', '备用站登录明文密码（仅本地用于算哈希）'],
  ['IKUN_MYSQL_HOST', '主站 MySQL 主机'],
  ['IKUN_MYSQL_USER', '主站 MySQL 用户'],
  ['IKUN_MYSQL_DB', '主站数据库名'],
];

function validate() {
  const missing = REQUIRED.filter(([key]) => {
    const v = process.env[key];
    return v === undefined || String(v).trim() === '';
  });
  if (missing.length === 0) return true;

  const hasEnvFile = existsSync(envFile);
  console.error('\n❌ 缺少必要配置：\n');
  for (const [key, hint] of missing) {
    console.error(`   ${key.padEnd(24)} — ${hint}`);
  }
  console.error('');
  if (!hasEnvFile) {
    console.error(`提示：还没有 .env 文件。先执行：`);
    console.error(`   cp .env.example .env`);
    console.error(`然后编辑 ${envFile} 填好上面这些值。\n`);
  } else {
    console.error(`提示：请编辑 ${envFile} 补上这些值，或在命令前用环境变量临时指定。\n`);
  }
  return false;
}

loadEnvFile(envFile);

const dryRun = process.argv.includes('--dry-run');

if (!validate()) process.exit(1);

if (dryRun) {
  console.log('[push] --dry-run：配置检查通过，开始只读校验……');
}

push({ dryRun }).catch((err) => {
  console.error(`\n❌ 推送失败：${err?.message || err}\n`);
  process.exitCode = 1;
});
