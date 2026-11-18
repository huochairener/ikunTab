#!/usr/bin/env node
// KV 绑定诊断：查明 ESA 里 env.IKUN_KV 到底是什么、有哪些方法可用。
// 用法（pages 目录下，读取 .env）：
//   npm run kv:debug       # 或 node scripts/kv-debug.mjs
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pagesDir = resolve(here, '..');
const envFile = join(pagesDir, '.env');

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnvFile(envFile);

const url = String(process.env.IKUN_SYNC_URL || '').replace(/\/+$/, '');
const secret = String(process.env.IKUN_SYNC_SECRET || '');

if (!url || !secret) {
  console.error('❌ 需要 IKUN_SYNC_URL 与 IKUN_SYNC_SECRET（写在 pages/.env 里）');
  process.exit(1);
}

const resp = await fetch(`${url}/api/kv-debug`, {
  headers: { authorization: `Bearer ${secret}` },
});
const text = await resp.text();
let body = null;
try {
  body = JSON.parse(text);
} catch {
  /* ignore */
}

if (!resp.ok || !body || body.code !== 0) {
  console.error(`❌ 诊断失败：HTTP ${resp.status} ${text}`);
  process.exit(1);
}

const info = body.data;
console.log('=== ESA 边缘存储（EdgeKV）诊断 ===');
console.log('存储空间名称  : ' + (info.namespace || '(未配置)'));
console.log('取自环境变量  : ' + info.namespaceFrom);
console.log('全局 EdgeKV 类: ' + (info.hasGlobalEdgeKV ? '可用' : '不可用'));
console.log('全局相关对象  : ' + JSON.stringify(info.globalKeys));
console.log('');
console.log('创建实例      : ' + JSON.stringify(info.createTest));
console.log('写入测试      : ' + JSON.stringify(info.writeTest));
console.log('读回测试      : ' + JSON.stringify(info.readTest));
console.log('');
console.log('现有快照清单  : ' + JSON.stringify(info.manifest, null, 2));
console.log('');
if (info.writeTest?.ok && info.readTest?.ok) {
  console.log('✅ EdgeKV 工作正常，可以执行 npm run push');
} else {
  console.log('❌ EdgeKV 不可用，请检查：');
  console.log('   1. ESA 控制台「边缘计算 → 边缘存储」是否已创建存储空间');
  console.log('   2. 函数变量里 IKUN_KV_NAMESPACE 是否等于该空间名称（区分大小写）');
  console.log('   3. 修改环境变量后是否重新部署');
}
