// KV 存储层：ESA「边缘存储（EdgeKV）」，只读镜像模式的数据来源。
//
// 数据由主站「主动推送」写入（POST /api/sync），备用站只读。
//
// ESA 官方 API（边缘存储 API）：
//   const edgeKv = new EdgeKV({ namespace: "ns" });
//   await edgeKv.get(key, { type: 'json' })   // 不存在返回 null
//   await edgeKv.put(key, value)              // value 为 string，单条最大 1.8MB
//   await edgeKv.delete(key)                  // 返回 true/false
//
// 注意：ESA 通过**环境变量**指定存储空间名（默认 EDGE_KV_NAMESPACE），
// 而不是把 KV 句柄绑定进 env。EdgeKV 是运行时全局类。
//
// 单条 Value 上限 1.8MB，所以快照按分片存储：manifest 记录分片清单，
// 每个分片一个 key，避免书签变多后超出单条限制。
import { BizError } from './http.js';

const MANIFEST_KEY = 'ikun_manifest';
const CHUNK_PREFIX = 'ikun_chunk_';
// 单条上限 1.8MB，留出余量，按 1.5MB 分片
const CHUNK_BYTES = 1_500_000;
const SNAPSHOT_FORMAT = 1;

/** 取环境变量（ESA 函数变量） */
function envValue(cfg, key, fallback = '') {
  const env = cfg?.env || {};
  if (env[key] !== undefined && env[key] !== null && String(env[key]).trim() !== '') {
    return String(env[key]).trim();
  }
  return fallback;
}

/** 存储空间名称：优先 IKUN_KV_NAMESPACE，其次 EDGE_KV_NAMESPACE */
export function kvNamespace(cfg) {
  return envValue(cfg, 'IKUN_KV_NAMESPACE') || envValue(cfg, 'EDGE_KV_NAMESPACE');
}

/**
 * 创建 EdgeKV 实例。
 * EdgeKV 是 ESA 运行时的全局类；本地 Node 环境没有，所以这里做兼容封装。
 */
export function getKV(cfg) {
  const namespace = kvNamespace(cfg);
  if (!namespace) {
    throw new BizError(
      '未配置存储空间名称：请在 ESA 控制台添加环境变量 IKUN_KV_NAMESPACE（或 EDGE_KV_NAMESPACE），' +
        '值填你在「边缘计算 → 边缘存储」创建的空间名称',
      503,
    );
  }

  const Ctor = globalThis.EdgeKV;
  if (typeof Ctor === 'function') {
    try {
      return new Ctor({ namespace });
    } catch (err) {
      throw new BizError(`创建 EdgeKV 实例失败（namespace=${namespace}）：${err?.message || err}`, 503);
    }
  }

  // 本地开发：如果 cfg 里注入了 kvImpl（内存实现），就用它
  if (cfg?.kvImpl) return cfg.kvImpl;

  throw new BizError(
    '当前运行时不支持 EdgeKV（未找到全局 EdgeKV 类）。' +
      '若在 ESA 边缘函数上出现此错误，请确认平台已支持边缘存储；本地开发请用 dev-server',
    503,
  );
}

function normKVError(err) {
  const msg = String(err?.message || err || '');
  if (/timeout|timed out/i.test(msg)) return new BizError('KV 读取超时，请稍后重试', 503);
  if (/namespace/i.test(msg)) return new BizError(`KV 存储空间不可用：${msg}`, 503);
  return new BizError(`KV 访问失败：${msg}`, 503);
}

/** 读 raw 文本 */
async function kvGetText(kv, key) {
  try {
    const value = await kv.get(key, { type: 'text' });
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') return value;
    // 兼容某些实现返回流/对象
    if (typeof value === 'object' && typeof value.text === 'function') return await value.text();
    return String(value);
  } catch (err) {
    throw normKVError(err);
  }
}

/** 写 raw 文本 */
async function kvPutText(kv, key, text) {
  try {
    await kv.put(key, text);
  } catch (err) {
    throw normKVError(err);
  }
}

async function kvDelete(kv, key) {
  try {
    if (typeof kv.delete === 'function') await kv.delete(key);
  } catch {
    /* 清理失败无所谓 */
  }
}

/** EdgeKV 的 key 只允许字母、数字、- 和 _ */
function safeKey(prefix, index) {
  return `${prefix}${index}`.replace(/[^A-Za-z0-9_-]/g, '_');
}

/**
 * 读取整份快照（自动拼接分片）；未同步过返回 null。
 */
export async function readSnapshot(cfg) {
  const kv = getKV(cfg);

  const manifestText = await kvGetText(kv, MANIFEST_KEY);
  if (!manifestText) return null;

  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    return null;
  }
  if (!manifest || manifest.format !== SNAPSHOT_FORMAT) return null;

  const count = Number(manifest.chunks) || 0;
  const parts = [];
  for (let i = 0; i < count; i += 1) {
    const text = await kvGetText(kv, safeKey(CHUNK_PREFIX, i));
    if (text === null) {
      // 分片缺失说明写入未完成或已被清理，按无数据处理，避免返回残缺快照
      return null;
    }
    parts.push(text);
  }

  let data;
  try {
    data = JSON.parse(parts.join(''));
  } catch {
    return null;
  }

  return {
    updatedAt: Number(manifest.updatedAt) || 0,
    users: Array.isArray(data.users) ? data.users : [],
    groups: Array.isArray(data.groups) ? data.groups : [],
    bookmarks: Array.isArray(data.bookmarks) ? data.bookmarks : [],
    settings: Array.isArray(data.settings) ? data.settings : [],
    searchEngines: Array.isArray(data.searchEngines) ? data.searchEngines : [],
  };
}

/**
 * 写入整份快照（分片）。
 * 先写全部分片，最后写 manifest —— manifest 是提交点，
 * 这样即使中途失败，读到的仍是上一份完整快照。
 */
export async function writeSnapshot(cfg, snapshot) {
  const kv = getKV(cfg);

  const payload = {
    users: snapshot.users,
    groups: snapshot.groups,
    bookmarks: snapshot.bookmarks,
    settings: snapshot.settings,
    searchEngines: snapshot.searchEngines,
  };

  const json = JSON.stringify(payload);

  // 写入前先读旧 manifest，记下旧分片数，写入后清理多余分片
  let prevChunks = 0;
  try {
    const oldText = await kvGetText(kv, MANIFEST_KEY);
    if (oldText) prevChunks = Number(JSON.parse(oldText).chunks) || 0;
  } catch {
    prevChunks = 0;
  }

  // 按 UTF-8 字节切分，且不切断多字节字符
  const chunks = [];
  let offset = 0;
  while (offset < json.length) {
    let bytes = 0;
    let end = offset;
    while (end < json.length) {
      const code = json.charCodeAt(end);
      // UTF-8 字节数：ASCII=1，常见中日韩=3，代理对按 4 保守计入
      let charBytes;
      if (code < 0x80) charBytes = 1;
      else if (code < 0x800) charBytes = 2;
      else if (code >= 0xd800 && code <= 0xdbff) charBytes = 4;
      else charBytes = 3;
      if (bytes + charBytes > CHUNK_BYTES) break;
      bytes += charBytes;
      end += 1;
    }
    if (end === offset) end = offset + 1; // 兜底，避免死循环
    chunks.push(json.slice(offset, end));
    offset = end;
  }

  const updatedAt = Date.now();
  for (let i = 0; i < chunks.length; i += 1) {
    await kvPutText(kv, safeKey(CHUNK_PREFIX, i), chunks[i]);
  }

  const manifest = {
    format: SNAPSHOT_FORMAT,
    updatedAt,
    chunks: chunks.length,
    bytes: json.length,
    counts: {
      users: payload.users?.length || 0,
      groups: payload.groups?.length || 0,
      bookmarks: payload.bookmarks?.length || 0,
      settings: payload.settings?.length || 0,
      searchEngines: payload.searchEngines?.length || 0,
    },
  };
  // manifest 是提交点：写完后旧快照即失效
  await kvPutText(kv, MANIFEST_KEY, JSON.stringify(manifest));

  // 清理旧快照遗留的多余分片（分片数变少时）
  for (let i = chunks.length; i < prevChunks; i += 1) {
    await kvDelete(kv, safeKey(CHUNK_PREFIX, i));
  }

  return { updatedAt, chunks: chunks.length, bytes: json.length };
}

/** 快照是否可用 */
export async function snapshotReady(cfg) {
  const snap = await readSnapshot(cfg);
  return Boolean(snap && snap.updatedAt > 0);
}

/**
 * 诊断：确认 EdgeKV 是否可用、namespace 配置是否正确。
 */
export async function inspectKV(cfg) {
  const namespace = kvNamespace(cfg);
  const hasGlobal = typeof globalThis.EdgeKV === 'function';

  const info = {
    namespace,
    namespaceFrom: envValue(cfg, 'IKUN_KV_NAMESPACE')
      ? 'IKUN_KV_NAMESPACE'
      : envValue(cfg, 'EDGE_KV_NAMESPACE')
        ? 'EDGE_KV_NAMESPACE'
        : '(未配置)',
    hasGlobalEdgeKV: hasGlobal,
    globalKeys: Object.keys(globalThis).filter((k) => /kv|kvstorage|edge/i.test(k)).slice(0, 20),
    createTest: null,
    writeTest: null,
    readTest: null,
    manifest: null,
  };

  if (!namespace) {
    info.createTest = { ok: false, error: '未配置命名空间环境变量' };
    return info;
  }
  if (!hasGlobal && !cfg?.kvImpl) {
    info.createTest = { ok: false, error: '运行时没有全局 EdgeKV 类' };
    return info;
  }

  let kv;
  try {
    kv = getKV(cfg);
    info.createTest = { ok: true };
  } catch (err) {
    info.createTest = { ok: false, error: String(err?.message || err) };
    return info;
  }

  const probeKey = `ikun_probe_${Date.now()}`;
  const probeValue = `ok-${Date.now()}`;
  try {
    await kv.put(probeKey, probeValue);
    info.writeTest = { ok: true };
  } catch (err) {
    info.writeTest = { ok: false, error: String(err?.message || err) };
  }
  try {
    const back = await kv.get(probeKey, { type: 'text' });
    info.readTest = { ok: back === probeValue, value: back === null ? null : String(back).slice(0, 60) };
  } catch (err) {
    info.readTest = { ok: false, error: String(err?.message || err) };
  }
  await kvDelete(kv, probeKey);

  try {
    const m = await kvGetText(kv, MANIFEST_KEY);
    info.manifest = m ? JSON.parse(m) : null;
  } catch (err) {
    info.manifest = { error: String(err?.message || err) };
  }

  return info;
}
