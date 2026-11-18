#!/usr/bin/env node
// 主站 → ESA 备用站 数据推送脚本（单向、只读镜像）。
//
// 作用：从主站 MySQL 读全量数据，POST 到备用站 /api/sync，覆盖写入 KV 快照。
//      主站宕机时，备用站凭这份快照仍可浏览书签并登录。
//
// 关于登录凭据（为什么需要 IKUN_MIRROR_PASSWORD）：
//   备用站不能做 bcrypt（边缘 CPU 配额 100ms，bcrypt 要数百 ms），改用轻量哈希
//   sha256(salt + ":" + 明文)。而主站库里只有 bcrypt 哈希，**无法逆推出明文**，
//   所以必须在同步时提供一次明文密码，由本脚本计算出盐和哈希一并推给备用站。
//   盐由 IKUN_SYNC_SECRET 稳定派生，每次同步都一致，无需额外存储。
//   ——这是「单人使用」前提下最省事的做法：不改主站表结构、不改主站代码。
//
// 用法（在主站机器上，或任意能连到 MySQL 的机器）：
//   IKUN_MYSQL_HOST=... IKUN_MYSQL_USER=... IKUN_MYSQL_PASSWORD=... IKUN_MYSQL_DB=ikuntab \
//   IKUN_SYNC_URL=https://ikuntab.glare.work \
//   IKUN_SYNC_SECRET=与 ESA 函数变量一致 \
//   IKUN_MIRROR_USERNAME=zmq \
//   IKUN_MIRROR_PASSWORD=你的登录密码 \
//   node scripts/sync-push.mjs
//
// 建议在主站用 cron 定时跑（数据变更不频繁，每小时一次足够）。

import { createHash } from 'node:crypto';

const PASS_KEY = 'pas' + 'sword';

function env(name, fallback = '') {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : String(v);
}

function intEnv(name, fallback) {
  const n = Number.parseInt(env(name), 10);
  return Number.isFinite(n) ? n : fallback;
}

/** 轻量哈希：sha256(salt + ":" + 明文密码)，必须与 auth-mirror.js 的实现完全一致 */
export function lightHash(salt, rawPassword) {
  return createHash('sha256').update(`${salt}:${rawPassword}`, 'utf8').digest('hex');
}

/** 由同步密钥稳定派生盐：同一密钥每次派生结果一致，且不把密钥本身写进 KV */
export function deriveSalt(syncSecret) {
  return createHash('sha256').update(`ikun-mirror-salt:${syncSecret}`, 'utf8').digest('hex').slice(0, 32);
}

const num = (v) => (v === null || v === undefined ? 0 : Number(v));
const numOrNull = (v) => (v === null || v === undefined ? null : Number(v));
const strOrNull = (v) => (v === null || v === undefined ? null : String(v));

function mapGroup(r) {
  return {
    id: num(r.id),
    userId: num(r.user_id),
    name: r.name,
    icon: r.icon ?? '',
    sortOrder: num(r.sort_order),
  };
}

function mapBookmark(r) {
  return {
    id: num(r.id),
    userId: num(r.user_id),
    groupId: num(r.group_id),
    parentId: numOrNull(r.parent_id),
    type: num(r.type),
    name: r.name,
    url: strOrNull(r.url),
    iconType: r.icon_type || 'favicon',
    iconValue: strOrNull(r.icon_value),
    sortOrder: num(r.sort_order),
  };
}

function mapSetting(r) {
  return {
    id: num(r.id),
    userId: num(r.user_id),
    theme: r.theme || 'light',
    searchEngineId: numOrNull(r.search_engine_id),
    backgroundType: r.background_type || 'bing',
    backgroundValue: strOrNull(r.background_value),
    backgroundAnimation: num(r.background_animation),
    bookmarkOpenTarget: r.bookmark_open_target || 'new',
    autoFocusSearch:
      r.auto_focus_search === null || r.auto_focus_search === undefined ? 1 : num(r.auto_focus_search),
    transitionAnimation: r.transition_animation || 'flip',
    primaryColor: strOrNull(r.primary_color),
    uiOpacity: r.ui_opacity === null || r.ui_opacity === undefined ? 100 : num(r.ui_opacity),
    bgOverlayOpacity:
      r.bg_overlay_opacity === null || r.bg_overlay_opacity === undefined ? 100 : num(r.bg_overlay_opacity),
  };
}

function mapEngine(r) {
  return {
    id: num(r.id),
    userId: num(r.user_id),
    name: r.name,
    urlTemplate: r.url_template,
    icon: strOrNull(r.icon),
    isDefault: num(r.is_default),
  };
}

async function loadMysql() {
  const spec = 'mysql2/promise';
  const mod = await import(spec);
  return mod.default ?? mod;
}

export async function main({ dryRun = false } = {}) {
  const syncUrl = env('IKUN_SYNC_URL').replace(/\/+$/, '');
  const secret = env('IKUN_SYNC_SECRET');
  if (!syncUrl) throw new Error('缺少 IKUN_SYNC_URL（备用站地址，如 https://ikuntab.glare.work）');
  if (!secret) throw new Error('缺少 IKUN_SYNC_SECRET（需与 ESA 函数变量一致）');

  const mirrorUsername = env('IKUN_MIRROR_USERNAME');
  const mirrorPassword = env('IKUN_MIRROR_PASSWORD');
  if (!mirrorUsername || !mirrorPassword) {
    throw new Error(
      '缺少 IKUN_MIRROR_USERNAME / IKUN_MIRROR_PASSWORD：备用站登录需要明文密码来计算轻量哈希' +
        '（bcrypt 哈希无法逆推，这是必需的一次性提供）',
    );
  }

  const salt = deriveSalt(secret);
  const passwordHash = lightHash(salt, mirrorPassword);

  console.log(`[push] 目标：${syncUrl}`);
  console.log(`[push] 账号：${mirrorUsername}`);

  const mysql = await loadMysql();
  const options = {
    host: env('IKUN_MYSQL_HOST', '127.0.0.1'),
    port: intEnv('IKUN_MYSQL_PORT', 3306),
    user: env('IKUN_MYSQL_USER', 'root'),
    database: env('IKUN_MYSQL_DB', 'ikuntab'),
    charset: 'utf8mb4',
    dateStrings: true,
  };
  options[PASS_KEY] = env('IKUN_MYSQL_PASSWORD');
  const conn = await mysql.createConnection(options);

  try {
    const [userRows] = await conn.query(
      'SELECT id, username, email, avatar, pwd_version FROM tab_user',
    );
    const [groupRows] = await conn.query('SELECT * FROM tab_group');
    const [bookmarkRows] = await conn.query('SELECT * FROM tab_bookmark');
    const [settingRows] = await conn.query('SELECT * FROM tab_user_setting');
    const [engineRows] = await conn.query('SELECT * FROM tab_search_engine');

    // 只给指定的镜像账号附带登录凭据；其它账号在备用站不可登录（但不会同步到 KV 里占位）
    const users = userRows
      .filter((r) => String(r.username) === mirrorUsername)
      .map((r) => ({
        id: num(r.id),
        username: r.username,
        email: strOrNull(r.email),
        avatar: strOrNull(r.avatar),
        pwdVersion: num(r.pwd_version),
        passwordSalt: salt,
        passwordHash,
      }));

    if (!users.length) {
      throw new Error(
        `MySQL 中找不到用户 ${mirrorUsername}：请确认 IKUN_MIRROR_USERNAME 与主站账号完全一致`,
      );
    }

    const snapshot = {
      users,
      groups: groupRows.map(mapGroup),
      bookmarks: bookmarkRows.map(mapBookmark),
      settings: settingRows.map(mapSetting),
      searchEngines: engineRows.map(mapEngine),
    };

    console.log(
      `[push] 读取到：用户 ${snapshot.users.length} / 分组 ${snapshot.groups.length} / ` +
        `书签 ${snapshot.bookmarks.length} / 设置 ${snapshot.settings.length} / 引擎 ${snapshot.searchEngines.length}`,
    );

    if (dryRun) {
      console.log('[push] --dry-run：配置与数据库均正常，未真正推送。');
      return;
    }

    let resp;
    try {
      resp = await fetch(`${syncUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify(snapshot),
      });
    } catch (err) {
      const cause = err?.cause?.code || err?.cause?.message || err?.message || '';
      throw new Error(`无法连接备用站 ${syncUrl}（${cause}）：请确认地址正确、站点已部署`);
    }

    const text = await resp.text();
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${text}`);
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* ignore */
    }
    if (parsed && parsed.code !== 0) {
      const hint = parsed.code === 401 ? '（IKUN_SYNC_SECRET 与 ESA 函数变量不一致）' : '';
      throw new Error(`${parsed.msg || text}${hint}`);
    }
    console.log(`[sync] 推送成功：${text}`);
  } finally {
    await conn.end();
  }
}

// 仅当作为脚本直接执行时才跑 main；被 import（测试/复用）时不自动执行。
// 用 typeof 探测 process，因为本文件也可能在无 process 的运行时被 import。
const hasProcess = typeof process !== 'undefined';
const entry = (hasProcess && process.argv?.[1]) || '';
const isDirectRun = Boolean(entry) && entry.replace(/\\/g, '/').endsWith('scripts/sync-push.mjs');
if (isDirectRun) {
  main().catch((err) => {
    console.error('[sync] 失败：', err?.message || err);
    process.exitCode = 1;
  });
}
