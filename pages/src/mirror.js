// 只读镜像：从 KV 快照中读取数据，并模拟出与 db.js 相同的「行」结构。
//
// 设计目标：让 routes/* 里的查询逻辑尽量靠**同一种数据形状**工作，
// 这样 SQL 与 KV 两种实现可以共享 mapper 和响应构造。
// 但需要说明：镜像模式下这些 routes 是**只读**的，写操作一律拒绝。
import { readSnapshot } from './kv.js';

/**
 * 把快照索引成便于查询的结构。
 * 每次请求重建一次（快照只有几十条，成本可忽略），避免跨请求缓存陈旧数据。
 */
function indexSnapshot(snap) {
  return {
    raw: snap,
    users: snap?.users || [],
    groups: snap?.groups || [],
    bookmarks: snap?.bookmarks || [],
    settings: snap?.settings || [],
    searchEngines: snap?.searchEngines || [],
  };
}

/** 读取快照并索引；未同步过返回 null（由上层决定如何提示） */
export async function loadIndex(cfg) {
  const snap = await readSnapshot(cfg);
  return snap ? indexSnapshot(snap) : null;
}

/** 按用户名查找用户（含登录凭据字段） */
export function findUserByUsername(idx, username) {
  if (!idx) return null;
  return idx.users.find((u) => String(u.username) === String(username)) || null;
}

/** 按 id 查找用户 */
export function findUserById(idx, id) {
  if (!idx) return null;
  return idx.users.find((u) => Number(u.id) === Number(id)) || null;
}

/** 某用户的全部分组，按 sortOrder 排序 */
export function listGroups(idx, uid) {
  if (!idx) return [];
  return idx.groups
    .filter((g) => Number(g.userId) === Number(uid))
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
}

/** 某用户某分组下的书签，按 sortOrder 排序 */
export function listBookmarks(idx, uid, groupId) {
  if (!idx) return [];
  return idx.bookmarks
    .filter((b) => Number(b.userId) === Number(uid) && Number(b.groupId) === Number(groupId))
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
}

/** 某用户的设置（单条） */
export function findSetting(idx, uid) {
  if (!idx) return null;
  return idx.settings.find((s) => Number(s.userId) === Number(uid)) || null;
}

/** 某用户的搜索引擎列表 */
export function listSearchEngines(idx, uid) {
  if (!idx) return [];
  return idx.searchEngines.filter((e) => Number(e.userId) === Number(uid));
}
