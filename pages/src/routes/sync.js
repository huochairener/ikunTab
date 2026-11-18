// /api/sync：主站 → 备用站 的**单向**数据推送入口。
//
// 鉴权：共享密钥（IKUN_SYNC_SECRET），主站需带 Authorization: Bearer <密钥>。
// 语义：整份快照覆盖写入（全量）。数据量小（单人使用），全量最简单、不会半新半旧。
import { BizError, json, ok, readJson } from '../http.js';
import { writeSnapshot, inspectKV } from '../kv.js';

function timingSafeEqual(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  if (x.length !== y.length || x.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

function extractToken(request) {
  const auth = request.headers.get('authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return (request.headers.get('x-sync-secret') || '').trim();
}

function assertAuthorized(ctx) {
  const secret = ctx.cfg.syncSecret;
  if (!secret) {
    throw new BizError('备用站未配置 IKUN_SYNC_SECRET，拒绝同步', 503);
  }
  const provided = extractToken(ctx.request);
  if (!timingSafeEqual(provided, secret)) {
    throw new BizError('同步密钥不正确', 401);
  }
}

function asArray(value, field) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new BizError(`字段 ${field} 必须是数组`, 400);
  return value;
}

/** 校验推送内容的基本结构，避免把脏数据写进 KV */
function validate(body) {
  const users = asArray(body.users, 'users');
  for (const u of users) {
    if (!u || typeof u !== 'object') throw new BizError('users 中存在非法条目', 400);
    if (Number(u.id) === undefined || !Number.isFinite(Number(u.id))) {
      throw new BizError('users 缺少 id', 400);
    }
    if (typeof u.username !== 'string' || !u.username) {
      throw new BizError('users 缺少 username', 400);
    }
    // 登录凭据：轻量哈希 + 盐，两者都必须存在，否则该账号在备用站无法登录
    if (typeof u.passwordHash !== 'string' || !u.passwordHash) {
      throw new BizError(`用户 ${u.username} 缺少 passwordHash`, 400);
    }
    if (typeof u.passwordSalt !== 'string' || !u.passwordSalt) {
      throw new BizError(`用户 ${u.username} 缺少 passwordSalt`, 400);
    }
  }

  return {
    users,
    groups: asArray(body.groups, 'groups'),
    bookmarks: asArray(body.bookmarks, 'bookmarks'),
    settings: asArray(body.settings, 'settings'),
    searchEngines: asArray(body.searchEngines, 'searchEngines'),
  };
}

export async function sync(ctx) {
  assertAuthorized(ctx);
  const body = await readJson(ctx);
  const snapshot = validate(body);
  const updatedAt = await writeSnapshot(ctx.cfg, snapshot);
  return json(
    ok({
      updatedAt,
      counts: {
        users: snapshot.users.length,
        groups: snapshot.groups.length,
        bookmarks: snapshot.bookmarks.length,
        settings: snapshot.settings.length,
        searchEngines: snapshot.searchEngines.length,
      },
    }),
  );
}

/** 诊断 KV 绑定形态：需要同步密钥，避免暴露给公众 */
export async function kvDebug(ctx) {
  assertAuthorized(ctx);
  const info = await inspectKV(ctx.cfg);
  return json(ok(info));
}

export const syncRoutes = [
  ['POST', '/api/sync', sync],
  ['GET', '/api/kv-debug', kvDebug],
];
