// /api/upload：备用站没有可写磁盘，上传直接转发给主站（Python 写到 /app/uploads）
// 未配置主站地址时明确报错，避免前端静默失败。
import { BizError } from '../http.js';
import { requireUserId } from './auth.js';
import { okJson } from '../http.js';

export async function upload(ctx) {
  await requireUserId(ctx); // 与主站一致：必须登录才能上传
  const origin = ctx.cfg.uploadOrigin;

  if (!origin) {
    throw new BizError('备用站不支持上传文件，请到主站上传（配置 IKUN_API_ORIGIN 可自动转发）', 500);
  }

  const headers = new Headers();
  const contentType = ctx.request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const cookie = ctx.request.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);

  const body = await ctx.request.arrayBuffer();
  const res = await fetch(`${origin}/api/upload`, { method: 'POST', headers, body });
  const text = await res.text();

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && 'code' in parsed) {
      return new Response(JSON.stringify(parsed), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
  } catch {
    /* 回落到下面的错误分支 */
  }
  throw new BizError('主站上传接口暂不可用，请稍后重试', 502);
}

export const uploadRoutes = [
  ['POST', '/api/upload', upload],
];
