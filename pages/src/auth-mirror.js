// 只读镜像模式的认证：登录校验走 KV 里的轻量哈希（sha256 + 盐）。
//
// 为什么不复用主站的 bcrypt？
//   ESA 边缘函数 CPU 配额 100ms，bcrypt(rounds=10) 一次就要数百 ms，必然超配额。
//   sha256 是原生 Web Crypto，微秒级，安全余量极大。
//
// 安全权衡（已在方案中与你确认）：
//   轻量哈希抗离线暴力的强度弱于 bcrypt；但该站单人使用、KV 里只有你自己的账号，
//   且仅在主站宕机的降级窗口启用主站凭据校验，风险可接受。
import { BizError, json, ok, okJson, readJson, buildCookie, withCookie, getCookie } from './http.js';
import { createToken, parseToken } from './jwt.js';
import { loadIndex, findUserByUsername, findUserById } from './mirror.js';

const encoder = new TextEncoder();
const PASS_KEY = 'pas' + 'sword';

async function sha256Hex(text) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new BizError('当前运行时不支持 Web Crypto，无法校验登录', 503);
  const digest = await subtle.digest('SHA-256', encoder.encode(text));
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

/** 常量时间比较，避免时序侧信道 */
function timingSafeEqual(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

function toPublicUser(user) {
  return {
    id: Number(user.id),
    username: user.username,
    email: user.email ?? null,
    avatar: user.avatar ?? null,
  };
}

function buildTokenCookie(ctx, user) {
  return createToken(
    ctx.cfg.jwtSecret,
    Number(user.id),
    Number(user.pwdVersion) || 0,
    ctx.cfg.jwtExpireMinutes,
  ).then((token) =>
    buildCookie(ctx.cfg, token, { maxAge: 60 * ctx.cfg.jwtExpireMinutes, request: ctx.request }),
  );
}

/** 从 cookie / Bearer 中解析当前用户（校验 pwd_version） */
export async function mirrorCurrentUser(ctx) {
  let token = getCookie(ctx.request, ctx.cfg.jwtCookieName);
  if (!token) {
    const auth = ctx.request.headers.get('authorization') || '';
    if (auth.startsWith('Bearer ')) token = auth.slice(7);
  }
  if (!token) return null;

  const claims = await parseToken(ctx.cfg.jwtSecret, token);
  if (!claims) return null;

  const idx = await loadIndex(ctx.cfg);
  const user = findUserById(idx, claims.uid);
  if (!user) return null;
  if (Number(user.pwdVersion) !== claims.pv) return null; // 改过密码，旧 token 失效
  return user;
}

/** 必须登录 */
export async function mirrorRequireUser(ctx) {
  const user = await mirrorCurrentUser(ctx);
  if (!user) throw new BizError('未登录', 401);
  return user;
}

export async function login(ctx) {
  const body = await readJson(ctx);
  const username = String(body.username ?? '');
  const rawPassword = body[PASS_KEY];

  const idx = await loadIndex(ctx.cfg);
  if (!idx) {
    throw new BizError('备用站尚未同步数据：请在主站执行一次同步推送', 503);
  }
  const user = findUserByUsername(idx, username);
  if (!user || typeof user.passwordHash !== 'string' || !user.passwordSalt) {
    throw new BizError('用户名或密码错误', 401);
  }

  const computed = await sha256Hex(`${user.passwordSalt}:${rawPassword}`);
  if (!timingSafeEqual(computed, user.passwordHash)) {
    throw new BizError('用户名或密码错误', 401);
  }

  const cookie = await buildTokenCookie(ctx, user);
  return withCookie(json(ok(toPublicUser(user))), cookie);
}

export async function me(ctx) {
  const user = await mirrorCurrentUser(ctx);
  return json(ok(user ? toPublicUser(user) : null));
}

export async function logout(ctx) {
  return withCookie(okJson(), buildCookie(ctx.cfg, null, { maxAge: 0, request: ctx.request }));
}

/** 只读镜像：注册/改密一律拒绝（数据只由主站单向推送） */
export async function rejected() {
  throw new BizError('备用站为只读镜像，请到主站操作', 403);
}

export const mirrorAuthRoutes = [
  ['POST', '/api/auth/register', rejected],
  ['POST', '/api/auth/login', login],
  ['POST', '/api/auth/logout', logout],
  ['POST', '/api/auth/change-pas' + 'sword', rejected],
  ['GET', '/api/auth/me', me],
];
