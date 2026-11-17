// 本地调试服务器：把 Node 的 req/res 适配成 Web 标准的 Request/Response。
// 用法：
//   1) cp .env.example .env 并按需填写
//   2) npm install
//   3) npm run dev      # 默认 http://127.0.0.1:18080
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const pagesDir = resolve(here, '..');

// 极简 .env 解析（不引入 dotenv 依赖）
function loadEnvFile() {
  const file = join(pagesDir, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

const port = Number(process.env.PORT || 18080);
const host = process.env.HOST || '127.0.0.1';
const distDir = join(pagesDir, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

async function toRequest(req) {
  const url = `http://${req.headers.host || `${host}:${port}`}${req.url}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else headers.set(key, String(value));
  }
  const method = (req.method || 'GET').toUpperCase();
  let body;
  if (method !== 'GET' && method !== 'HEAD') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = Buffer.concat(chunks);
  }
  return new Request(url, { method, headers, body });
}

async function writeResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return;
    res.setHeader(key, value);
  });
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  if (cookies.length) res.setHeader('set-cookie', cookies);

  if (!response.body) {
    res.end();
    return;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}

function serveStatic(req, res, pathname) {
  if (!existsSync(distDir)) return false;
  const decoded = decodeURIComponent(pathname);
  const target = normalize(join(distDir, decoded));
  if (!target.startsWith(distDir)) return false;

  let file = target;
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) || statSync(file).isDirectory()) return false;

  const ext = extname(file).toLowerCase();
  res.setHeader('content-type', MIME[ext] || 'application/octet-stream');
  createReadStream(file).pipe(res);
  return true;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`);
    if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/uploads/')) {
      if (serveStatic(req, res, url.pathname)) return;
      // SPA 兜底
      const index = join(distDir, 'index.html');
      if (existsSync(index)) {
        res.setHeader('content-type', MIME['.html']);
        createReadStream(index).pipe(res);
        return;
      }
    }
    const request = await toRequest(req);
    const response = await handler.fetch(request, {}, process.env);
    await writeResponse(res, response);
  } catch (err) {
    console.error('[dev]', err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ code: 500, msg: '本地调试服务器异常', data: null }));
  }
});

server.listen(port, host, () => {
  console.log(`[dev] http://${host}:${port}`);
  console.log(`[dev] data source: ${process.env.IKUN_DATA_SOURCE || 'auto'}`);
});
