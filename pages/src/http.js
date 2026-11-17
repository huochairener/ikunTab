// HTTP 小工具：统一响应 R<T>、Cookie、请求体解析。
// 响应结构与 Python 主站完全一致：{ code, msg, data }，code=0 表示成功。

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

/** 业务异常：与 Python BizException 等价，走 HTTP 200 + code 的约定 */
export class BizError extends Error {
  constructor(msg, code = 400) {
    super(msg);
    this.name = 'BizError';
    this.msg = msg;
    this.code = code;
  }
}

export function ok(data = null) {
  return { code: 0, msg: 'ok', data };
}

export function fail(msg, code = 500) {
  return { code, msg, data: null };
}

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

/** 成功响应 */
export function okJson(data = null) {
  return json(ok(data));
}

/** 业务失败：HTTP 200 + 业务 code，与 Python 端一致（前端拦截器按 code 判断） */
export function bizJson(msg, code = 500) {
  return json(fail(msg, code));
}

export async function readJson(input) {
  let text = '';
  if (input && typeof input === 'object' && input.rawBody instanceof Uint8Array) {
    text = new TextDecoder().decode(input.rawBody);
  } else if (input && typeof input.text === 'function') {
    text = await input.text();
  } else if (typeof input === 'string') {
    text = input;
  }
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') return parsed;
    throw new Error('not an object');
  } catch {
    throw new BizError('请求体不是合法的 JSON', 400);
  }
}

export function parseCookieHeader(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = decodeURIComponent(value);
  }
  return out;
}

export function getCookie(request, name) {
  return parseCookieHeader(request.headers.get('cookie'))[name] ?? null;
}

export function isHttps(request) {
  try {
    if (new URL(request.url).protocol === 'https:') return true;
  } catch {
    /* ignore */
  }
  return (request.headers.get('x-forwarded-proto') || '').split(',')[0].trim() === 'https';
}

/** 生成 Set-Cookie 值；token 为 null 时表示清除 */
export function buildCookie(cfg, token, { maxAge, request }) {
  const parts = [`${cfg.jwtCookieName}=${token ?? ''}`];
  parts.push('Path=/');
  parts.push(`Max-Age=${token ? maxAge : 0}`);
  parts.push('HttpOnly');
  parts.push('SameSite=Lax');
  if (isHttps(request)) parts.push('Secure');
  return parts.join('; ');
}

/** 在响应上追加 Set-Cookie（保留状态码与 body） */
export function withCookie(response, cookieValue) {
  const headers = new Headers(response.headers);
  headers.append('set-cookie', cookieValue);
  return new Response(response.body, { status: response.status, headers });
}

/** 统一异常 → 响应 */
export function errorResponse(err) {
  if (err instanceof BizError) return bizJson(err.msg, err.code);
  return json(fail('系统异常，请稍后重试', 500), 500);
}

export function badRequest(msg) {
  throw new BizError(msg, 400);
}

export function intParam(raw, field, fallback = null) {
  if (raw === null || raw === undefined || raw === '') {
    if (fallback !== null) return fallback;
    badRequest(`缺少参数 ${field}`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) badRequest(`参数 ${field} 不合法`);
  return Math.trunc(n);
}
