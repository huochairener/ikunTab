// 冒烟测试：不需要数据库、不需要安装依赖，直接校验入口、路由、JWT、鉴权、
// 无数据库依赖的几个接口。配合 dev-server 可做真实联调。
// 用法：npm run check
import handler from '../src/index.js';

const BASE = 'http://localhost';

// 直连模式 + 占位数据库配置：下面这些用例都不会真正访问数据库
const DIRECT_ENV = {
  IKUN_DATA_SOURCE: 'direct',
  IKUN_MYSQL_HOST: '127.0.0.1',
  IKUN_MYSQL_USER: 'unused',
  IKUN_JWT_SECRET: 'unit-test-secret',
};

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: Boolean(cond), extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  ${extra}` : ''}`);
}

async function call(path, init = {}, env = {}) {
  const request = new Request(`${BASE}${path}`, init);
  return handler.fetch(request, {}, env);
}

async function jsonOf(res) {
  return res.json();
}

async function main() {
  // 1) 未登录访问 /api/auth/me：应当返回 data=null（不需要数据库）
  {
    const env = DIRECT_ENV;
    const res = await call('/api/auth/me', {}, env);
    const body = await jsonOf(res);
    check('GET /api/auth/me 未登录返回 null', res.status === 200 && body.code === 0 && body.data === null, JSON.stringify(body));
  }

  // 2) 未登录访问受保护接口：code=401（HTTP 200，与 Python 一致）
  {
    const env = DIRECT_ENV;
    const res = await call('/api/groups', {}, env);
    const body = await jsonOf(res);
    check('GET /api/groups 未登录返回 code=401', res.status === 200 && body.code === 401, JSON.stringify(body));
  }

  // 3) favicon 代理（纯计算，不依赖数据库）：data 是 { url } 对象，与 Python 主站一致
  {
    const env = DIRECT_ENV;
    const res = await call('/api/favicon?url=https://www.bilibili.com', {}, env);
    const body = await jsonOf(res);
    check(
      'GET /api/favicon 返回 { url } 对象',
      body.code === 0 && typeof body.data === 'object' && String(body.data?.url).includes('icon.horse/icon/bilibili.com'),
      JSON.stringify(body),
    );
  }

  // 3b) favicon 非法输入：url 为 null
  {
    const env = DIRECT_ENV;
    const res = await call('/api/favicon?url=not a url', {}, env);
    const body = await jsonOf(res);
    check('GET /api/favicon 非法输入返回 url=null', body.code === 0 && body.data?.url === null, JSON.stringify(body));
  }

  // 4) 未知接口 404
  {
    const env = DIRECT_ENV;
    const res = await call('/api/not-exists', {}, env);
    const body = await jsonOf(res);
    check('未知接口返回 404', res.status === 404 && body.code === 404, JSON.stringify(body));
  }

  // 5) JWT 与 Python 互通：用同一密钥签发、解析，并验证过期/篡改
  {
    const { createToken, parseToken } = await import('../src/jwt.js');
    const secret = 'unit-test-secret';
    const token = await createToken(secret, 7, 3, 60);
    const parsed = await parseToken(secret, token);
    check('JWT 签发/解析', parsed && parsed.uid === 7 && parsed.pv === 3, JSON.stringify(parsed));

    const bad = await parseToken('other-secret', token);
    check('JWT 错误密钥被拒绝', bad === null);

    const expired = await createToken(secret, 7, 3, -1);
    check('JWT 过期被拒绝', (await parseToken(secret, expired)) === null);

    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -2)}xx`;
    check('JWT 篡改签名被拒绝', (await parseToken(secret, tampered)) === null);
  }

  // 6) 配置默认值：未配置任何变量时应当能生成配置对象
  {
    const { createConfig } = await import('../src/config.js');
    const cfg = createConfig({});
    check('默认配置可用', cfg.dataSource === 'auto' && cfg.jwtCookieName === 'ikun_token' && cfg.jwtExpireMinutes > 0);
  }

  // 7) 代理模式未配置主站地址：应返回明确的 503 配置错误，而不是 500
  {
    const env = { IKUN_DATA_SOURCE: 'proxy' };
    const res = await call('/api/groups', {}, env);
    const body = await jsonOf(res);
    check('代理模式未配置 IKUN_API_ORIGIN 返回 503', res.status === 503 && body.code === 503, JSON.stringify(body));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
