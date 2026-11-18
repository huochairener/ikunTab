// 代理模式：把请求转发给现有 Python 主站（同一套接口、同一个数据库）。
// 用于：边缘函数没有 TCP 能力时兜底；或显式配置 IKUN_DATA_SOURCE=proxy。

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
  'content-encoding',
]);

const REQUEST_HEADERS = [
  'cookie',
  'authorization',
  'content-type',
  'accept',
  'accept-language',
  'user-agent',
  'x-requested-with',
];

function safeTimeout(ms) {
  try {
    return AbortSignal.timeout(ms);
  } catch {
    return undefined;
  }
}

async function forward(request, base, { timeoutMs = 15000, body = null } = {}) {
  const source = new URL(request.url);
  const target = `${base}${source.pathname}${source.search}`;

  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const init = {
    method: request.method,
    headers,
    redirect: 'manual',
    signal: safeTimeout(timeoutMs),
    // 复用边缘节点到主站的连接，避免每次请求都重新握手（主站是 HTTP/1.1，无 h2 多路复用）
    keepalive: true,
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = body instanceof Uint8Array ? body : await request.arrayBuffer();
  }

  const upstream = await fetch(target, init);
  const outHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) return;
    if (lower === 'set-cookie') return; // 单独处理，避免被合并
    outHeaders.set(key, value);
  });

  const getSetCookie = upstream.headers.getSetCookie;
  if (typeof getSetCookie === 'function') {
    for (const cookie of upstream.headers.getSetCookie()) outHeaders.append('set-cookie', cookie);
  } else {
    const single = upstream.headers.get('set-cookie');
    if (single) outHeaders.append('set-cookie', single);
  }

  // 关键：不能把 upstream.body（ReadableStream）直接透传给客户端。
  // ESA 边缘函数在流式透传时，若两个 chunk 的读取间隔超过内部阈值，会抛
  // "exceeded timeout between two consecutive response body reads"，
  // 同时流式搬运会吃掉大量 CPU（配额仅 100ms）。
  // 接口响应体积很小（书签列表也就几百字节到几十 KB），先完整读入内存再返回。
  const buffer = await upstream.arrayBuffer();

  return new Response(buffer, { status: upstream.status, headers: outHeaders });
}

export function hasUpstream(cfg) {
  return Boolean(cfg.apiOrigin);
}

/** 转发 /api/* 到主站 */
export async function proxyApi(request, cfg, { body = null } = {}) {
  return forward(request, cfg.apiOrigin, { body });
}

/** 转发 /uploads/* 静态资源（上传的图片/背景）到主站 */
export async function proxyAsset(request, cfg, { body = null } = {}) {
  const base = cfg.uploadOrigin || cfg.apiOrigin;
  if (!base) return new Response('Not Found', { status: 404 });
  return forward(request, base, { timeoutMs: 20000, body });
}
