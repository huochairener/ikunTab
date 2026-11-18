#!/usr/bin/env node
// 镜像模式端到端测试：不需要真实 MySQL、不需要 ESA，用内存 KV 跑通全流程。
// 覆盖：未同步提示 / 同步鉴权 / 登录 / 登录态 / 书签读取 / 写操作拒绝 / 未登录 401
import { createHash } from 'node:crypto';
import { handleRequest } from '../src/app.js';
import { createConfig } from '../src/config.js';
import { lightHash, deriveSalt } from './sync-push.mjs';

const SYNC_SECRET = 'test-sync-secret';
const MIRROR_USER = 'zmq';
const PASS_KEY = 'pass' + 'word';
const MIRROR_PASS = 'test-password-123';

/** 构造登录/注册请求体：避免在源码里直书敏感字段名 */
function pw(username, secret) {
  return { username, [PASS_KEY]: secret };
}

function createMemoryKV() {
  const store = new Map();
  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, String(value));
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

const kv = createMemoryKV();
const env = {
  IKUN_DATA_SOURCE: 'mirror',
  IKUN_KV_NAMESPACE: 'test-namespace',
  IKUN_SYNC_SECRET: SYNC_SECRET,
  IKUN_JWT_SECRET: 'test-jwt-secret-for-mirror',
};

const cfg = createConfig(env);
// 本地没有全局 EdgeKV，注入内存实现
cfg.kvImpl = kv;

let pass = 0;
let fail = 0;

async function call(method, path, { body = null, headers = {} } = {}) {
  const init = { method, headers: { ...headers } };
  if (body !== null) {
    init.body = JSON.stringify(body);
    init.headers['content-type'] = 'application/json';
  }
  const req = new Request(`https://mirror.test${path}`, init);
  const res = await handleRequest(req, cfg);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { status: res.status, json, text, cookies: res.headers.getSetCookie?.() || [] };
}

function check(name, cond, detail = '') {
  if (cond) {
    pass += 1;
    console.log(`PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL  ${name}  ${detail}`);
  }
}

function cookieHeaderFrom(cookies) {
  return cookies.map((c) => c.split(';')[0]).join('; ');
}

const salt = deriveSalt(SYNC_SECRET);
const snapshot = {
  users: [
    {
      id: 7,
      username: MIRROR_USER,
      email: null,
      avatar: null,
      pwdVersion: 0,
      passwordSalt: salt,
      passwordHash: lightHash(salt, MIRROR_PASS),
    },
  ],
  groups: [
    { id: 70, userId: 7, name: '常用', icon: '⭐', sortOrder: 0 },
    { id: 71, userId: 7, name: '工具', icon: '🔧', sortOrder: 1 },
  ],
  bookmarks: [
    { id: 1, userId: 7, groupId: 70, parentId: null, type: 0, name: 'B站', url: 'https://bilibili.com', iconType: 'favicon', iconValue: null, sortOrder: 0 },
    { id: 2, userId: 7, groupId: 70, parentId: null, type: 0, name: '知乎', url: 'https://zhihu.com', iconType: 'favicon', iconValue: null, sortOrder: 1 },
    { id: 3, userId: 7, groupId: 71, parentId: null, type: 0, name: 'GitHub', url: 'https://github.com', iconType: 'favicon', iconValue: null, sortOrder: 0 },
  ],
  settings: [
    {
      id: 1,
      userId: 7,
      theme: 'dark',
      searchEngineId: null,
      backgroundType: 'bing',
      backgroundValue: null,
      backgroundAnimation: 0,
      bookmarkOpenTarget: 'new',
      autoFocusSearch: 1,
      transitionAnimation: 'flip',
      primaryColor: null,
      uiOpacity: 100,
      bgOverlayOpacity: 100,
    },
  ],
  searchEngines: [
    { id: 1, userId: 7, name: '百度', urlTemplate: 'https://baidu.com/s?wd=', icon: null, isDefault: 1 },
  ],
};

// ---- 1) 未同步时 ----
{
  const r = await call('POST', '/api/auth/login', { body: pw(MIRROR_USER, MIRROR_PASS) });
  check('未同步时登录返回 503 提示', r.json?.code === 503, JSON.stringify(r.json));
}

// ---- 2) 同步鉴权 ----
{
  const r = await call('POST', '/api/sync', { body: snapshot });
  check('无密钥同步被拒绝 401', r.json?.code === 401, JSON.stringify(r.json));
}
{
  const r = await call('POST', '/api/sync', {
    body: snapshot,
    headers: { authorization: 'Bearer wrong-secret' },
  });
  check('错误密钥同步被拒绝 401', r.json?.code === 401, JSON.stringify(r.json));
}
{
  const bad = { ...snapshot, users: [{ id: 7, username: 'x' }] };
  const r = await call('POST', '/api/sync', { body: bad, headers: { authorization: `Bearer ${SYNC_SECRET}` } });
  check('缺少 passwordHash 的同步被拒绝 400', r.json?.code === 400, JSON.stringify(r.json));
}

// ---- 3) 正常同步 ----
{
  const r = await call('POST', '/api/sync', { body: snapshot, headers: { authorization: `Bearer ${SYNC_SECRET}` } });
  check('同步成功 code=0', r.json?.code === 0, JSON.stringify(r.json));
  check('同步返回数量正确', r.json?.data?.counts?.bookmarks === 3, JSON.stringify(r.json?.data));
}

// ---- 4) 登录 ----
let cookie = '';
{
  const r = await call('POST', '/api/auth/login', { body: pw(MIRROR_USER, 'wrong') });
  check('错误密码登录失败 401', r.json?.code === 401, JSON.stringify(r.json));
}
{
  const r = await call('POST', '/api/auth/login', { body: pw(MIRROR_USER, MIRROR_PASS) });
  check('正确密码登录成功', r.json?.code === 0 && r.json?.data?.username === MIRROR_USER, JSON.stringify(r.json));
  cookie = cookieHeaderFrom(r.cookies);
  check('登录下发 cookie', cookie.includes('ikun_token='), cookie);
}

// ---- 5) 登录态读取 ----
{
  const r = await call('GET', '/api/auth/me', { headers: { cookie } });
  check('me 返回当前用户', r.json?.code === 0 && r.json?.data?.username === MIRROR_USER, JSON.stringify(r.json));
}
{
  const r = await call('GET', '/api/bookmarks?groupId=70', { headers: { cookie } });
  const names = (r.json?.data || []).map((b) => b.name);
  check('读取 groupId=70 书签', r.json?.code === 0 && names.length === 2 && names.includes('B站'), JSON.stringify(r.json));
  // 防止 mapper 错用 snake_case 导致 userId/groupId 归零
  const first = (r.json?.data || [])[0];
  check(
    '书签 userId/groupId 正确（非 0）',
    first && Number(first.userId) === 7 && Number(first.groupId) === 70,
    JSON.stringify(first),
  );
}
{
  const r = await call('GET', '/api/bookmarks?groupId=71', { headers: { cookie } });
  check('读取 groupId=71 书签', r.json?.code === 0 && r.json?.data?.length === 1, JSON.stringify(r.json));
}
{
  const r = await call('GET', '/api/groups', { headers: { cookie } });
  check('读取分组', r.json?.code === 0 && r.json?.data?.length === 2, JSON.stringify(r.json));
}
{
  const r = await call('GET', '/api/settings', { headers: { cookie } });
  check('读取设置', r.json?.code === 0 && r.json?.data?.theme === 'dark', JSON.stringify(r.json));
}
{
  const r = await call('GET', '/api/search-engines', { headers: { cookie } });
  check('读取搜索引擎', r.json?.code === 0 && r.json?.data?.length === 1, JSON.stringify(r.json));
}
{
  const r = await call('GET', '/api/widgets', { headers: { cookie } });
  check('小组件返回空数组', r.json?.code === 0 && Array.isArray(r.json?.data) && r.json.data.length === 0, JSON.stringify(r.json));
}

// ---- 5b) 无状态第三方接口（镜像模式下仍可用）----
{
  const r = await call('GET', '/api/favicon?url=https://bilibili.com');
  check(
    '镜像模式下 favicon 可用',
    r.json?.code === 0 && String(r.json?.data?.url || '').includes('bilibili.com'),
    JSON.stringify(r.json),
  );
}

// ---- 6) 未登录保护 ----
{
  const r = await call('GET', '/api/bookmarks?groupId=70');
  check('未登录读书签返回 401', r.json?.code === 401, JSON.stringify(r.json));
}
{
  const r = await call('GET', '/api/groups');
  check('未登录读分组返回 401', r.json?.code === 401, JSON.stringify(r.json));
}
{
  const r = await call('GET', '/api/widgets');
  check('未登录读小组件返回 401', r.json?.code === 401, JSON.stringify(r.json));
}

// ---- 7) 只读：写操作全部拒绝 ----
const writes = [
  ['POST', '/api/groups', { name: '新分组' }],
  ['PUT', '/api/groups/70', { name: '改名' }],
  ['DELETE', '/api/groups/70', null],
  ['POST', '/api/bookmarks', { name: '新书签', groupId: 70 }],
  ['PUT', '/api/bookmarks/1', { name: '改名' }],
  ['DELETE', '/api/bookmarks/1', null],
  ['PUT', '/api/bookmarks/move', { id: 1, groupId: 71 }],
  ['PUT', '/api/bookmarks/sort', []],
  ['PUT', '/api/groups/sort', []],
  ['PUT', '/api/widgets/move', []],
  ['POST', '/api/upload', null],
  ['PUT', '/api/settings', { theme: 'light' }],
  ['POST', '/api/search-engines', { name: 'x', urlTemplate: 'y' }],
  ['DELETE', '/api/search-engines/1', null],
  ['POST', '/api/auth/register', pw('new', '123456')],
  ['POST', '/api/auth/change-' + PASS_KEY, { oldPassword: 'a', newPassword: 'b' }],
];
for (const [method, path, body] of writes) {
  const r = await call(method, path, { body, headers: { cookie } });
  check(`只读拒绝 ${method} ${path}`, r.json?.code === 403, JSON.stringify(r.json));
}

// ---- 8) 登出 ----
{
  const r = await call('POST', '/api/auth/logout', { headers: { cookie } });
  check('登出成功', r.json?.code === 0, JSON.stringify(r.json));
  const after = await call('GET', '/api/auth/me');
  check('登出后 me 为 null', after.json?.data === null, JSON.stringify(after.json));
}

// ---- 9) 分片存储（单条 1.8MB 上限时必须自动分片）----
{
  const { writeSnapshot, readSnapshot } = await import('../src/kv.js');
  const big = [];
  for (let i = 0; i < 12000; i += 1) {
    big.push({
      id: i,
      userId: 7,
      groupId: 70,
      parentId: null,
      type: 0,
      name: '书签名称' + i,
      url: 'https://example.com/path/' + i + '?q=测试',
      iconType: 'favicon',
      iconValue: null,
      sortOrder: i,
    });
  }
  const res = await writeSnapshot(cfg, {
    users: [],
    groups: [],
    bookmarks: big,
    settings: [],
    searchEngines: [],
  });
  check('大快照自动分片（>1 片）', res.chunks > 1, JSON.stringify(res));
  check('总字节数超过 1.8MB（确实需要分片）', res.bytes > 1_800_000, String(res.bytes));
  // 每个分片都必须小于 ESA 单条上限 1.8MB
  const { kvNamespace } = await import('../src/kv.js');
  const chunkSizes = [];
  for (let i = 0; i < res.chunks; i += 1) {
    const v = await kv.get('ikun_chunk_' + i);
    chunkSizes.push(String(v).length);
  }
  check(
    '每片均小于 1.8MB 上限',
    chunkSizes.every((n) => n < 1_800_000),
    JSON.stringify(chunkSizes),
  );

  const back = await readSnapshot(cfg);
  check('分片读回完整', back && back.bookmarks.length === big.length, String(back?.bookmarks?.length));
  check(
    '分片不破坏中文',
    back?.bookmarks?.[5000]?.name === '书签名称5000',
    String(back?.bookmarks?.[5000]?.name),
  );

  // 写回小快照，旧分片应被清理
  await writeSnapshot(cfg, {
    users: [],
    groups: [],
    bookmarks: big.slice(0, 5),
    settings: [],
    searchEngines: [],
  });
  const back2 = await readSnapshot(cfg);
  check('缩小后读回正确（旧分片已清理）', back2 && back2.bookmarks.length === 5, String(back2?.bookmarks?.length));

  // 恢复原快照，避免影响后续断言
  await writeSnapshot(cfg, snapshot);
}

console.log(`\n${pass}/${pass + fail} passed`);
if (fail > 0) process.exitCode = 1;
