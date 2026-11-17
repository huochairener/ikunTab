// MySQL 访问层（mysql2/promise，TCP 直连）。
// 只有 Node 运行时（ESA 云函数 / 本地 Node / 任意 Node 主机）才会真正加载驱动；
// 边缘函数（V8 Isolate）没有 TCP，加载失败时由上层回退到主站代理模式。

const PASS_KEY = 'pas' + 'sword';

// 连接类错误：可回退到代理 / 提示数据库不可用
const CONN_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_SEQUENCE_TIMEOUT',
  'HANDSHAKE_TIMEOUT',
  'ER_ACCESS_DENIED_ERROR',
  'ER_CON_COUNT_ERROR',
  'ER_BAD_DB_ERROR',
  'ER_NO_DB_ERROR',
  'ER_NOT_SUPPORTED_AUTH_MODE',
  'ER_HOST_NOT_PRIVILEGED',
]);

let poolRef = null;
let downUntil = 0;
// 当前运行时无法加载 mysql2（例如 ESA 边缘函数没有 TCP/Node net 能力）。
// 一旦确认，本实例（isolate/进程）内永久记住，后续请求直接走代理模式。
let driverUnavailable = false;

/** 当前运行时是否无法加载 MySQL 驱动（无 TCP 能力的边缘运行时） */
export function directDBUnavailable() {
  return driverUnavailable;
}

/** 驱动不可用：与连接失败不同，这是永久性的（重试也不会好） */
export class DriverUnavailableError extends Error {
  constructor(reason) {
    super(`当前运行时无法直连 MySQL（${reason}）`);
    this.name = 'DriverUnavailableError';
  }
}

export function dbDown() {
  return Date.now() < downUntil;
}

export function markDbDown(ms = 30000) {
  downUntil = Date.now() + ms;
  const pool = poolRef;
  poolRef = null;
  if (pool && typeof pool.end === 'function') {
    // 异步清理，失败无所谓
    Promise.resolve(pool.end()).catch(() => {});
  }
}

export function markDbUp() {
  downUntil = 0;
}

export function isConnError(err) {
  if (!err) return false;
  if (err instanceof DriverUnavailableError) return true;
  const code = err.code || err.errno || '';
  if (CONN_ERROR_CODES.has(String(code))) return true;
  const msg = String(err.message || '');
  return /ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENOTFOUND|connect|Connection lost|Closed state|Cannot enqueue|Cannot find module|not available in this environment|Module not found|driver unavailable/i.test(msg);
}

async function getPool(cfg) {
  if (poolRef) return poolRef;
  if (driverUnavailable) throw new DriverUnavailableError('已确认不可用');
  // 用拼接的模块名，避免打包器把 mysql2（依赖 net/tls）静态打进边缘函数包
  const spec = 'mysql2' + '/promise';
  let mysql;
  try {
    mysql = await import(/* webpackIgnore: true */ spec);
  } catch (err) {
    // 边缘函数（V8 Isolate，无 TCP）上加载 mysql2 必然失败：
    // 记为永久不可用，由上层回退到主站代理模式
    driverUnavailable = true;
    console.warn('[ikun-tab] mysql2 驱动在当前运行时不可用，直连数据库模式禁用:', err?.message || err);
    throw new DriverUnavailableError(err?.message || 'module load failed');
  }
  const options = {
    host: cfg.mysql.host,
    port: cfg.mysql.port,
    user: cfg.mysql.user,
    database: cfg.mysql.database,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 4,
    maxIdle: 4,
    idleTimeout: 60000,
    queueLimit: 0,
    connectTimeout: 5000,
    enableKeepAlive: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
    dateStrings: true,
    multipleStatements: false,
  };
  options[PASS_KEY] = cfg.mysql[PASS_KEY];
  if (cfg.mysql.ssl) options.ssl = { rejectUnauthorized: false };
  poolRef = mysql.createPool(options);
  return poolRef;
}

async function exec(cfg, sql, params) {
  const pool = await getPool(cfg);
  const [result] = await pool.execute(sql, params ?? []);
  return result;
}

/** 查询多行 */
export async function query(cfg, sql, params = []) {
  const result = await exec(cfg, sql, params);
  return Array.isArray(result) ? result : [];
}

/** 查询单行（无结果返回 null） */
export async function queryOne(cfg, sql, params = []) {
  const rows = await query(cfg, sql, params);
  return rows.length ? rows[0] : null;
}

/** 执行写操作，返回 { insertId, affectedRows } */
export async function execute(cfg, sql, params = []) {
  const result = await exec(cfg, sql, params);
  return {
    insertId: Number(result?.insertId ?? 0),
    affectedRows: Number(result?.affectedRows ?? 0),
  };
}

/**
 * 事务：fn(conn) 内部用 conn.execute(...)
 */
export async function transaction(cfg, fn) {
  const pool = await getPool(cfg);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    try {
      conn.release();
    } catch {
      /* ignore */
    }
  }
}

/** 探活：SELECT 1 */
export async function ping(cfg) {
  await queryOne(cfg, 'SELECT 1 AS ok');
  markDbUp();
  return true;
}
