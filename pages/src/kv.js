// KV 存储层：只读镜像模式下，备用站的全部数据（含登录凭据）都来自 KV。
//
// 数据由主站「主动推送」写入（POST /api/sync），备用站只读，绝不反向写。
// 快照式存储：单人使用、数据量小，用少数几个 key 存整份快照，避免拆表带来的
// 一致性问题（没有事务，拆得越碎越容易一半新一半旧）。
//
// KV 绑定：在 ESA 控制台把 KV 命名空间绑定到函数，变量名默认 IKUN_KV
// （可用环境变量 IKUN_KV_BINDING 改名）。边缘函数里通过 env[绑定名] 访问。

import { BizError } from './http.js';

const SNAPSHOT_KEY = 'snapshot';
const SNAPSHOT_FORMAT = 1;

/** 在运行时 env 中查找 KV 命名空间句柄 */
export function getKV(cfg) {
  const env = cfg?.env || {};
  const name = cfg?.kvBinding || 'IKUN_KV';
  const kv = env[name];
  if (kv) return kv;
  // 兜底：常见的几个默认绑定名
  for (const fallback of ['IKUN_KV', 'KV', 'ikun_kv']) {
    if (env[fallback]) return env[fallback];
  }
  return null;
}

function requireKV(cfg) {
  const kv = getKV(cfg);
  if (!kv) {
    throw new BizError('备用站未绑定 KV 存储：请在 ESA 控制台绑定 KV 命名空间（变量名 IKUN_KV）', 503);
  }
  return kv;
}

function normKVError(err) {
  const msg = String(err?.message || err || '');
  if (/timeout|timed out/i.test(msg)) return new BizError('KV 读取超时，请稍后重试', 503);
  return new BizError(`KV 访问失败：${msg}`, 503);
}

async function kvGet(kv, key) {
  try {
    let value = null;
    if (typeof kv.get === 'function') {
      value = await kv.get(key, { type: 'text' });
    } else if (typeof kv.getJSON === 'function') {
      value = await kv.getJSON(key);
    }
    if (value === undefined || value === null) return null;
    // 有的实现直接返回对象，有的返回 JSON 字符串，两种都要兼容
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      return JSON.parse(trimmed);
    }
    return null;
  } catch (err) {
    if (err instanceof BizError) throw err;
    // JSON 解析失败也归类为 KV 异常
    throw normKVError(err);
  }
}

async function kvPut(kv, key, value) {
  try {
    if (typeof kv.put === 'function') {
      await kv.put(key, JSON.stringify(value));
      return;
    }
    if (typeof kv.putJSON === 'function') {
      await kv.putJSON(key, value);
      return;
    }
    throw new Error('KV 句柄不支持写入');
  } catch (err) {
    throw normKVError(err);
  }
}

/** 读取整份快照；未同步过返回 null */
export async function readSnapshot(cfg) {
  const kv = requireKV(cfg);
  const raw = await kvGet(kv, SNAPSHOT_KEY);
  if (!raw || typeof raw !== 'object') return null;
  if (raw.format !== SNAPSHOT_FORMAT) {
    // 格式不识别：当作空快照，避免用错结构渲染
    return null;
  }
  return {
    updatedAt: Number(raw.updatedAt) || 0,
    users: Array.isArray(raw.users) ? raw.users : [],
    groups: Array.isArray(raw.groups) ? raw.groups : [],
    bookmarks: Array.isArray(raw.bookmarks) ? raw.bookmarks : [],
    settings: Array.isArray(raw.settings) ? raw.settings : [],
    searchEngines: Array.isArray(raw.searchEngines) ? raw.searchEngines : [],
  };
}

/** 写入整份快照（仅 /api/sync 调用，主站推送） */
export async function writeSnapshot(cfg, snapshot) {
  const kv = requireKV(cfg);
  const payload = {
    format: SNAPSHOT_FORMAT,
    updatedAt: Date.now(),
    users: snapshot.users,
    groups: snapshot.groups,
    bookmarks: snapshot.bookmarks,
    settings: snapshot.settings,
    searchEngines: snapshot.searchEngines,
  };
  await kvPut(kv, SNAPSHOT_KEY, payload);
  return payload.updatedAt;
}

/** 快照是否可用（已同步过） */
export async function snapshotReady(cfg) {
  const snap = await readSnapshot(cfg);
  return Boolean(snap && snap.updatedAt > 0);
}
