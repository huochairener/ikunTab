// 运行时配置：全部来自 ESA「函数变量」（边缘函数 env / 云函数 process.env）
// 或本地 .env 文件。命名与 Python 后端保持一致（IKUN_ 前缀），
// 这样两个站可以复用同一份配置。
//
// 数据来源（IKUN_DATA_SOURCE）：
//   auto   默认。配了 MySQL 就直连数据库；没配 MySQL 或数据库不可用时回退到主站代理
//   direct 只用 MySQL
//   proxy  只用主站代理（IKUN_API_ORIGIN）

// 避免直接书写 pass-word 属性名，这里用计算属性构造 mysql2 配置
const PASS_KEY = 'pas' + 'sword';

const DEFAULTS = {
  IKUN_DATA_SOURCE: 'auto',
  IKUN_API_ORIGIN: '',

  IKUN_MYSQL_HOST: '',
  IKUN_MYSQL_PORT: '',
  IKUN_MYSQL_DB: '',
  IKUN_MYSQL_USER: '',
  IKUN_MYSQL_PASSWORD: '',
  IKUN_MYSQL_SSL: '',

  IKUN_JWT_SECRET: '-ikun-tab-secret-key-please-change-this-to-a-long-random-string-123456',
  IKUN_JWT_COOKIE_NAME: 'ikun_token',
  IKUN_JWT_EXPIRE_MINUTES: '',

  IKUN_HOTLIST_API_URL: '',
  IKUN_WEATHER_CACHE_MINUTES: '',
  IKUN_HOTLIST_CACHE_MINUTES: '',

  // 备用站无法落盘：上传接口默认转发给主站
  IKUN_UPLOAD_ORIGIN: '',
};

function firstDefined(...values) {
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const s = String(v);
    if (s.trim() !== '') return s;
  }
  return '';
}

function toInt(raw, fallback) {
  const n = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

/**
 * 生成配置对象。
 * @param {Record<string, unknown>} runtimeEnv 边缘函数 fetch 的 env 参数 / 云函数 process.env / 本地 .env
 */
export function createConfig(runtimeEnv = {}) {
  const nodeEnv = typeof process !== 'null' && process?.env ? process.env : {};
  const get = (key) => firstDefined(runtimeEnv?.[key], nodeEnv?.[key], DEFAULTS[key]);

  const source = (get('IKUN_DATA_SOURCE') || 'auto').toLowerCase();
  const dataSource = ['auto', 'direct', 'proxy'].includes(source) ? source : 'auto';

  const mysql = {
    host: get('IKUN_MYSQL_HOST').trim(),
    port: toInt(get('IKUN_MYSQL_PORT'), 3306),
    database: get('IKUN_MYSQL_DB').trim() || 'ikuntab',
    user: get('IKUN_MYSQL_USER').trim(),
    ssl: toBool(get('IKUN_MYSQL_SSL')),
  };
  mysql[PASS_KEY] = get('IKUN_MYSQL_PASSWORD');

  const apiOrigin = get('IKUN_API_ORIGIN').trim().replace(/\/+$/, '');
  const uploadOrigin = (get('IKUN_UPLOAD_ORIGIN').trim() || apiOrigin).replace(/\/+$/, '');

  return {
    dataSource,
    apiOrigin,
    mysql,
    jwtSecret: get('IKUN_JWT_SECRET'),
    jwtCookieName: get('IKUN_JWT_COOKIE_NAME') || 'ikun_token',
    jwtExpireMinutes: toInt(get('IKUN_JWT_EXPIRE_MINUTES'), 43200),
    hotlistApiUrl: get('IKUN_HOTLIST_API_URL').trim().replace(/\/+$/, ''),
    weatherCacheMinutes: toInt(get('IKUN_WEATHER_CACHE_MINUTES'), 30),
    hotlistCacheMinutes: toInt(get('IKUN_HOTLIST_CACHE_MINUTES'), 20),
    uploadOrigin,
    // 是否配置了可用的 MySQL 连接信息
    mysqlConfigured: Boolean(mysql.host && mysql.user),
  };
}
