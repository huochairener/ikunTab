// 请求分发：直连数据库 / 回退主站代理 / 统一异常处理
import { createRouter } from './router.js';
import { BizError, errorResponse, fail, json } from './http.js';
import { dbDown, directDBUnavailable, isConnError, markDbDown } from './db.js';
import { hasUpstream, proxyApi, proxyAsset } from './upstream.js';
import { authRoutes } from './routes/auth.js';
import { groupRoutes } from './routes/groups.js';
import { bookmarkRoutes } from './routes/bookmarks.js';
import { widgetRoutes } from './routes/widgets.js';
import { settingRoutes } from './routes/settings.js';
import { searchEngineRoutes } from './routes/search-engines.js';
import { uploadRoutes } from './routes/upload.js';
import { createProxyRoutes } from './routes/proxy.js';

const API_NOT_FOUND = () => json(fail('接口不存在', 404), 404);

function configError(message) {
  return json(fail(message, 503), 503);
}

/**
 * 处理一个请求
 * @param {Request} request
 * @param {ReturnType<import('./config.js').createConfig>} cfg
 */
export async function handleRequest(request, cfg) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  // 上传的图片/背景：转发到主站（备用站没有持久化磁盘）
  if (pathname.startsWith('/uploads/')) {
    if (!cfg.uploadOrigin && !cfg.apiOrigin) return new Response('Not Found', { status: 404 });
    return proxyAsset(request, cfg);
  }

  if (!pathname.startsWith('/api/')) return API_NOT_FOUND();

  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('origin');
    const headers = {
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'access-control-allow-headers': request.headers.get('access-control-request-headers') || '*',
      'access-control-allow-credentials': 'true',
    };
    if (origin) {
      headers['access-control-allow-origin'] = origin;
      headers['vary'] = 'origin';
    }
    return new Response(null, { status: 204, headers });
  }

  const router = createRouter([
    ...authRoutes,
    ...groupRoutes,
    ...bookmarkRoutes,
    ...widgetRoutes,
    ...settingRoutes,
    ...searchEngineRoutes,
    ...uploadRoutes,
    ...createProxyRoutes(cfg),
  ]);

  const matched = router(request.method, pathname);
  if (!matched) return API_NOT_FOUND();

  // 一次性缓冲请求体：数据库失败时可以原样转发给主站，不必二次读取
  let rawBody = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    rawBody = new Uint8Array(await request.arrayBuffer());
  }

  const ctx = { request, cfg, url, params: matched.params, rawBody };

  // 直连模式永久不可用（边缘函数无 TCP，mysql2 加载失败过）也归入代理模式
  const proxyOnly =
    cfg.dataSource === 'proxy' ||
    (cfg.dataSource === 'auto' && (!cfg.mysqlConfigured || directDBUnavailable()));
  if (proxyOnly) {
    if (!hasUpstream(cfg)) {
      return configError('备用站未配置数据源：请设置 IKUN_API_ORIGIN（转发主站）；若部署在支持 TCP 的 Node 运行时，也可配置 IKUN_MYSQL_* 直连数据库');
    }
    return forward(request, cfg, rawBody);
  }

  // 最近一次数据库连接失败，短时间内直接走主站，避免每次请求都等超时
  if (dbDown() && hasUpstream(cfg)) return forward(request, cfg, rawBody);

  try {
    return await matched.handler(ctx);
  } catch (err) {
    if (err instanceof BizError) return errorResponse(err);

    if (isConnError(err)) {
      markDbDown();
      console.error('[ikun-tab] db unavailable:', err?.message || err);
      if (hasUpstream(cfg)) {
        try {
          return await forward(request, cfg, rawBody);
        } catch (forwardErr) {
          console.error('[ikun-tab] upstream failed:', forwardErr?.message || forwardErr);
        }
      }
      return json(fail('数据库暂不可用，请稍后重试', 503), 503);
    }

    console.error('[ikun-tab] unhandled:', err?.stack || err);
    return json(fail('系统异常，请稍后重试', 500), 500);
  }
}

function forward(request, cfg, rawBody) {
  return proxyApi(request, cfg, { body: rawBody });
}
