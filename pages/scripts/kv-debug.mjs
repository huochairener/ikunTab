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
console.log('=== KV 绑定诊断 ===');
console.log(`绑定名        : ${info.bindingName}`);
console.log(`是否找到      : ${info.found}`);
console.log(`值的类型      : ${info.typeofValue}`);
console.log(`可用方法      : ${info.methods?.length ? info.methods.join(', ') : '(无)'}`);
console.log(`自有属性      : ${info.ownKeys?.length ? info.ownKeys.join(', ') : '(无)'}`);
console.log(`原型方法      : ${info.protoKeys?.length ? info.protoKeys.join(', ') : '(无)'}`);
console.log('');
console.log('写入测试:');
for (const t of info.writeTest || []) {
  console.log(`  ${t.ok ? '✅' : '❌'} ${t.api}${t.error ? ' — ' + t.error : ''}`);
}
console.log('');
console.log('读回测试:', JSON.stringify(info.readTest));
console.log('');
console.log('env 中可见的键及其类型（前 60 个）:');
const types = info.envTypes || {};
for (const k of info.envKeysSample || []) {
  const t = types[k] || '?';
  console.log(`  ${k}: ${t}`);
}
console.log('');
console.log('全局对象:', JSON.stringify(info.globals));
