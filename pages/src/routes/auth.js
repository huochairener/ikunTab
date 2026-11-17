// /api/auth：注册、登录、登出、改密、当前用户
// 与 backend-py/app/services/auth.py 行为保持一致（包括 200+code 的错误约定）
import { BizError, json, ok, okJson, readJson, getCookie, buildCookie, withCookie } from '../http.js';
import { createToken, parseToken } from '../jwt.js';
import { checkPassword, hashPassword, verifyPassword } from '../password.js';
import { execute, queryOne } from '../db.js';
import { toUser } from '../mappers.js';

const USER_COLUMNS = 'id, username, email, avatar, pwd_version';

/** 从 cookie 或 Authorization: Bearer 中解析当前用户 id，并校验 pwd_version */
export async function currentUserId(ctx) {
  const { cfg, request } = ctx;
  let token = getCookie(request, cfg.jwtCookieName);
  if (!token) {
    const auth = request.headers.get('authorization') || '';
    if (auth.startsWith('Bearer ')) token = auth.slice(7);
  }
  if (!token) return null;

  const claims = await parseToken(cfg.jwtSecret, token);
  if (!claims) return null;

  const row = await queryOne(ctx.cfg, 'SELECT id, pwd_version FROM tab_user WHERE id = ? LIMIT 1', [claims.uid]);
  if (!row) return null;
  if (Number(row.pwd_version) !== claims.pv) return null; // 改过密码，旧 token 失效
  return Number(row.id);
}

/** 必须登录，否则 401（前端拦截器会跳登录页） */
export async function requireUserId(ctx) {
  const uid = await currentUserId(ctx);
  if (!uid) throw new BizError('未登录', 401);
  return uid;
}

async function tokenCookie(ctx, user) {
  const token = await createToken(
    ctx.cfg.jwtSecret,
    Number(user.id),
    Number(user.pwd_version) || 0,
    ctx.cfg.jwtExpireMinutes,
  );
  return buildCookie(ctx.cfg, token, { maxAge: 60 * ctx.cfg.jwtExpireMinutes, request: ctx.request });
}

export async function register(ctx) {
  const body = await readJson(ctx);
  const username = String(body.username ?? '').trim();
  const rawPassword = body.password;
  const email = body.email ? String(body.email).trim() : null;

  if (!username || username.length > 64) throw new BizError('用户名长度需在 1-64 之间', 400);
  if (typeof rawPassword !== 'string' || rawPassword.length > 128) throw new BizError('密码长度需在 1-128 之间', 400);
  if (email && email.length > 128) throw new BizError('邮箱过长', 400);

  const exists = await queryOne(ctx.cfg, 'SELECT id FROM tab_user WHERE username = ? LIMIT 1', [username]);
  if (exists) throw new BizError('用户名已存在', 400);

  checkPassword(rawPassword);
  const hashed = await hashPassword(rawPassword);
  const result = await execute(
    ctx.cfg,
    'INSERT INTO tab_user (username, email, password, pwd_version) VALUES (?, ?, ?, 0)',
    [username, email, hashed],
  );
  return okJson({ id: result.insertId, username, email, avatar: null });
}

export async function login(ctx) {
  const body = await readJson(ctx);
  const username = String(body.username ?? '');
  const rawPassword = body.password;
  if (!username || typeof rawPassword !== 'string') throw new BizError('用户名或密码错误', 401);

  const row = await queryOne(ctx.cfg, `SELECT ${USER_COLUMNS}, password FROM tab_user WHERE username = ? LIMIT 1`, [username]);
  const valid = row ? await verifyPassword(rawPassword, row.password) : false;
  if (!row || !valid) throw new BizError('用户名或密码错误', 401);

  const cookie = await tokenCookie(ctx, row);
  return withCookie(json(ok(toUser(row))), cookie);
}

export async function logout(ctx) {
  return withCookie(okJson(), buildCookie(ctx.cfg, null, { maxAge: 0, request: ctx.request }));
}

export async function changePassword(ctx) {
  const uid = await requireUserId(ctx);
  const body = await readJson(ctx);
  const oldPassword = body.oldPassword;
  const newPassword = body.newPassword;
  if (typeof oldPassword !== 'string' || typeof newPassword !== 'string') {
    throw new BizError('参数不完整', 400);
  }

  const row = await queryOne(
    ctx.cfg,
    'SELECT id, password, pwd_version FROM tab_user WHERE id = ? LIMIT 1',
    [uid],
  );
  if (!row) throw new BizError('未登录', 401);
  if (!(await verifyPassword(oldPassword, row.password))) throw new BizError('当前密码不正确', 400);

  checkPassword(newPassword);
  const hashed = await hashPassword(newPassword);
  const nextVersion = Number(row.pwd_version || 0) + 1;
  await execute(ctx.cfg, 'UPDATE tab_user SET password = ?, pwd_version = ? WHERE id = ?', [hashed, nextVersion, uid]);

  const cookie = await tokenCookie(ctx, { id: uid, pwd_version: nextVersion });
  return withCookie(okJson(), cookie);
}

export async function me(ctx) {
  const uid = await currentUserId(ctx);
  if (!uid) return json(ok(null));
  const row = await queryOne(ctx.cfg, 'SELECT id, username, email, avatar FROM tab_user WHERE id = ? LIMIT 1', [uid]);
  return json(ok(row ? toUser(row) : null));
}

export const authRoutes = [
  ['POST', '/api/auth/register', register],
  ['POST', '/api/auth/login', login],
  ['POST', '/api/auth/logout', logout],
  ['POST', '/api/auth/change-password', changePassword],
  ['GET', '/api/auth/me', me],
];
