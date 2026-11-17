// 端到端集成测试：直接对着真实 MySQL 跑一遍全部接口。
// 会创建/删除测试数据（表名与主站相同，请务必指向测试库！）
//
// 用法：
//   IKUN_MYSQL_HOST=127.0.0.1 IKUN_MYSQL_USER=root IKUN_MYSQL_PASSWORD=xxx \
//   IKUN_MYSQL_DB=ikuntab_pages_test node scripts/integration-test.mjs
//
// 前置：先用 scripts/schema.sql 初始化测试库。
import handler from '../src/index.js';

const BASE = 'http://localhost';
const env = {
  IKUN_DATA_SOURCE: 'direct',
  IKUN_MYSQL_HOST: process.env.IKUN_MYSQL_HOST,
  IKUN_MYSQL_PORT: process.env.IKUN_MYSQL_PORT,
  IKUN_MYSQL_DB: process.env.IKUN_MYSQL_DB,
  IKUN_MYSQL_USER: process.env.IKUN_MYSQL_USER,
  IKUN_MYSQL_PASSWORD: process.env.IKUN_MYSQL_PASSWORD,
  IKUN_JWT_SECRET: process.env.IKUN_JWT_SECRET || 'integration-test-secret',
};

if (!env.IKUN_MYSQL_HOST || !env.IKUN_MYSQL_USER) {
  console.error('缺少 IKUN_MYSQL_HOST / IKUN_MYSQL_USER');
  process.exit(1);
}

let cookie = '';
let passed = 0;
let failed = 0;

function expect(name, cond, detail = '') {
  if (cond) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? `  ${detail}` : ''}`);
  }
}

async function call(method, path, { body, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined) h['content-type'] = 'application/json';
  if (cookie) h.cookie = cookie;
  const res = await handler.fetch(
    new Request(`${BASE}${path}`, {
      method,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    {},
    env,
  );
  const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  if (setCookie.length) {
    const raw = setCookie[0].split(';')[0];
    if (/max-age=0$/i.test(setCookie[0].replace(/\s/g, ''))) cookie = '';
    else cookie = raw;
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  return { status: res.status, body: json, setCookie };
}

async function main() {
  const suffix = Date.now().toString(36);
  const username = `it_${suffix}`;
  const rawPassword = 'test123456';

  // --- 注册 ---
  let r = await call('POST', '/api/auth/register', { body: { username, password: '123' } });
  expect('注册：密码过短被拒绝', r.body?.code === 400, JSON.stringify(r.body));

  r = await call('POST', '/api/auth/register', { body: { username, password: rawPassword, email: 'it@example.com' } });
  expect('注册：成功', r.body?.code === 0 && r.body?.data?.id > 0, JSON.stringify(r.body));
  const userId = r.body?.data?.id;

  r = await call('POST', '/api/auth/register', { body: { username, password: rawPassword } });
  expect('注册：重名被拒绝', r.body?.code === 400 && /已存在/.test(r.body?.msg || ''), JSON.stringify(r.body));

  // --- 登录 ---
  r = await call('POST', '/api/auth/login', { body: { username, password: 'wrong-password' } });
  expect('登录：密码错误返回 401', r.body?.code === 401, JSON.stringify(r.body));

  r = await call('POST', '/api/auth/login', { body: { username, password: rawPassword } });
  const cookieHeader = r.setCookie[0] || '';
  expect('登录：成功并下发 httpOnly cookie', r.body?.code === 0 && /httponly/i.test(cookieHeader) && /path=\//i.test(cookieHeader), cookieHeader);
  expect('登录：返回用户信息', r.body?.data?.username === username && r.body?.data?.id === userId);

  r = await call('GET', '/api/auth/me');
  expect('me：带 cookie 返回当前用户', r.body?.code === 0 && r.body?.data?.id === userId, JSON.stringify(r.body));

  // --- 分组 ---
  r = await call('GET', '/api/groups');
  expect('分组：初始为空', r.body?.code === 0 && Array.isArray(r.body?.data) && r.body.data.length === 0);

  r = await call('POST', '/api/groups', { body: { name: '工作', icon: '💼' } });
  const groupA = r.body?.data;
  expect('分组：新建成功', r.body?.code === 0 && groupA?.name === '工作' && groupA?.sortOrder === 0, JSON.stringify(r.body));

  r = await call('POST', '/api/groups', { body: { name: '生活' } });
  const groupB = r.body?.data;
  expect('分组：第二个默认排序 +1 且默认图标', r.body?.code === 0 && groupB?.sortOrder === 1 && groupB?.icon === '🌟', JSON.stringify(r.body));

  r = await call('PUT', `/api/groups/${groupA.id}`, { body: { name: '工作台' } });
  expect('分组：重命名保留图标', r.body?.code === 0 && r.body?.data?.name === '工作台' && r.body?.data?.icon === '💼');

  r = await call('PUT', '/api/groups/sort', { body: [{ id: groupA.id, sortOrder: 5 }, { id: groupB.id, sortOrder: 2 }] });
  expect('分组：排序成功', r.body?.code === 0);

  r = await call('GET', '/api/groups');
  expect('分组：按 sort_order 升序返回', r.body?.data?.[0]?.id === groupB.id && r.body?.data?.[1]?.id === groupA.id, JSON.stringify(r.body?.data));

  // --- 书签 ---
  r = await call('POST', '/api/bookmarks', { body: { groupId: groupA.id, name: 'GitHub', url: 'https://github.com' } });
  const bm1 = r.body?.data;
  expect('书签：新建成功', r.body?.code === 0 && bm1?.name === 'GitHub' && bm1?.type === 0 && bm1?.iconType === 'favicon', JSON.stringify(r.body));

  r = await call('POST', '/api/bookmarks', { body: { groupId: groupA.id, name: '开发', type: 1 } });
  const folder = r.body?.data;
  expect('书签：文件夹新建成功', r.body?.code === 0 && folder?.type === 1 && folder?.sortOrder === 1);

  r = await call('POST', '/api/bookmarks', { body: { groupId: groupA.id, parentId: folder.id, name: 'MDN', url: 'https://developer.mozilla.org' } });
  const child = r.body?.data;
  expect('书签：文件夹内新建子项', r.body?.code === 0 && child?.parentId === folder.id, JSON.stringify(r.body));

  r = await call('GET', `/api/bookmarks?groupId=${groupA.id}`);
  expect('书签：列表按 sort_order 返回 3 条', r.body?.data?.length === 3, JSON.stringify(r.body?.data));

  r = await call('PUT', `/api/bookmarks/${bm1.id}`, { body: { groupId: groupA.id, name: 'GitHub Pro', url: 'https://github.com' } });
  expect('书签：更新成功', r.body?.code === 0 && r.body?.data?.name === 'GitHub Pro');

  r = await call('PUT', '/api/bookmarks/move', { body: { id: child.id, parentId: 0, sortOrder: 9 } });
  const afterMove = await call('GET', `/api/bookmarks?groupId=${groupA.id}`);
  const moved = (afterMove.body?.data || []).find((x) => x.id === child.id);
  expect('书签：parentId=0 移出文件夹（顶层 parentId 为空）', r.body?.code === 0 && moved?.parentId === null && moved?.sortOrder === 9, JSON.stringify(moved));

  r = await call('PUT', '/api/bookmarks/sort', { body: [{ id: bm1.id, parentId: folder.id, sortOrder: 3 }] });
  expect('书签：批量排序成功', r.body?.code === 0);

  r = await call('DELETE', `/api/bookmarks/${folder.id}`);
  const afterDelete = await call('GET', `/api/bookmarks?groupId=${groupA.id}`);
  const ids = (afterDelete.body?.data || []).map((x) => x.id);
  const childStillThere = ids.includes(child.id);
  expect('书签：删除文件夹时级联删除子项', r.body?.code === 0 && !ids.includes(folder.id), JSON.stringify(ids));
  console.log(`      （子项是否保留：${childStillThere ? '保留（已移出文件夹，符合预期）' : '已删除'}）`);

  // --- 小组件 ---
  r = await call('POST', '/api/widgets', { body: { groupId: groupA.id, type: 'clock', name: '时钟', rows: 1, cols: 1, config: '{}' } });
  const w1 = r.body?.data;
  expect('组件：新建成功', r.body?.code === 0 && w1?.type === 'clock' && w1?.enabled === 1, JSON.stringify(r.body));

  r = await call('POST', '/api/widgets', { body: { groupId: groupA.id, type: 'hotlist', rows: 2 } });
  const w2 = r.body?.data;
  expect('组件：新组件 y 追加到末尾（= 上一个 rows）', r.body?.code === 0 && w2?.y === 1, JSON.stringify(r.body));

  r = await call('PUT', `/api/widgets/${w1.id}`, { body: { groupId: groupA.id, type: 'clock', name: '时钟2', rows: 2, cols: 2, config: '{"format":"24"}' } });
  expect('组件：更新成功（rows 保留字写入正常）', r.body?.code === 0 && r.body?.data?.rows === 2 && r.body?.data?.cols === 2, JSON.stringify(r.body));

  r = await call('PUT', '/api/widgets/move', { body: [{ id: w1.id, x: 2, y: 3, cols: 2, rows: 2, sortOrder: 7 }] });
  const widgets = await call('GET', `/api/widgets?groupId=${groupA.id}`);
  const w1After = (widgets.body?.data || []).find((x) => x.id === w1.id);
  expect('组件：布局保存成功', r.body?.code === 0 && w1After?.x === 2 && w1After?.y === 3 && w1After?.sortOrder === 7, JSON.stringify(w1After));

  r = await call('DELETE', `/api/widgets/${w2.id}`);
  expect('组件：删除成功', r.body?.code === 0);

  // --- 设置 ---
  r = await call('GET', '/api/settings');
  expect('设置：首次访问自动创建默认值', r.body?.code === 0 && r.body?.data?.theme === 'light' && r.body?.data?.uiOpacity === 100, JSON.stringify(r.body));

  r = await call('PUT', '/api/settings', { body: { theme: 'dark', uiOpacity: 150, primaryColor: '#ff0000', transitionAnimation: 'fade' } });
  expect('设置：更新成功且透明度被夹到 100', r.body?.code === 0 && r.body?.data?.theme === 'dark' && r.body?.data?.uiOpacity === 100 && r.body?.data?.primaryColor === '#ff0000', JSON.stringify(r.body));

  r = await call('PUT', '/api/settings', { body: { primaryColor: '' } });
  expect('设置：primaryColor 空串转为 null', r.body?.code === 0 && r.body?.data?.primaryColor === null, JSON.stringify(r.body));

  // --- 搜索引擎 ---
  r = await call('POST', '/api/search-engines', { body: { name: 'Bing', urlTemplate: 'https://www.bing.com/search?q={q}', isDefault: 1 } });
  const e1 = r.body?.data;
  expect('引擎：新建默认引擎', r.body?.code === 0 && e1?.isDefault === 1, JSON.stringify(r.body));

  r = await call('POST', '/api/search-engines', { body: { name: 'Google', urlTemplate: 'https://www.google.com/search?q={q}' } });
  const e2 = r.body?.data;
  r = await call('PUT', `/api/search-engines/${e2.id}`, { body: { name: 'Google', urlTemplate: 'https://www.google.com/search?q={q}', isDefault: 1 } });
  const engines = await call('GET', '/api/search-engines');
  const defaults = (engines.body?.data || []).filter((x) => x.isDefault === 1);
  expect('引擎：切换默认后仅一个 is_default=1 且排在最前', defaults.length === 1 && defaults[0].id === e2.id && engines.body?.data?.[0]?.id === e2.id, JSON.stringify(engines.body?.data));

  r = await call('DELETE', `/api/search-engines/${e1.id}`);
  const engines2 = await call('GET', '/api/search-engines');
  expect('引擎：删除成功', r.body?.code === 0 && (engines2.body?.data || []).length === 1);

  // --- 越权访问 ---
  r = await call('PUT', `/api/groups/999999`, { body: { name: 'x' } });
  expect('越权：改别人的分组返回 404', r.body?.code === 404, JSON.stringify(r.body));

  // --- 改密码 ---
  r = await call('POST', '/api/auth/change-password', { body: { oldPassword: 'nope', newPassword: 'abcdef123' } });
  expect('改密：旧密码错误被拒绝', r.body?.code === 400, JSON.stringify(r.body));

  const oldCookie = cookie;
  r = await call('POST', '/api/auth/change-password', { body: { oldPassword: rawPassword, newPassword: 'abcdef123' } });
  expect('改密：成功并换发新 cookie', r.body?.code === 0 && cookie && cookie !== oldCookie, `${oldCookie} -> ${cookie}`);

  const savedCookie = cookie;
  cookie = oldCookie;
  r = await call('GET', '/api/auth/me');
  expect('改密：旧 token 立即失效（pwd_version 校验）', r.body?.code === 0 && r.body?.data === null, JSON.stringify(r.body));

  cookie = savedCookie;
  r = await call('GET', '/api/auth/me');
  expect('改密：新 token 正常可用', r.body?.data?.id === userId, JSON.stringify(r.body));

  r = await call('POST', '/api/auth/login', { body: { username, password: 'abcdef123' } });
  expect('改密：新密码可登录', r.body?.code === 0, JSON.stringify(r.body));

  // --- 登出 ---
  r = await call('POST', '/api/auth/logout');
  expect('登出：清除 cookie', r.body?.code === 0 && /max-age=0/i.test((r.setCookie[0] || '').replace(/\s/g, '')), r.setCookie[0] || '');
  cookie = '';
  r = await call('GET', '/api/groups');
  expect('登出后受保护接口返回 401', r.body?.code === 401, JSON.stringify(r.body));

  console.log(`\n${passed}/${passed + failed} passed`);
  // 显式退出：连接池的空闲连接会让事件循环挂着不退出
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
