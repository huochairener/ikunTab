// /api/bookmarks：书签/文件夹增删改查、移动、排序
import { BizError, okJson, readJson, intParam } from '../http.js';
import { execute, query, queryOne, transaction } from '../db.js';
import { toBookmark } from '../mappers.js';
import { requireUserId } from './auth.js';

/** parent_id 归一化：0 / 负数 / 空 都表示“顶层” */
function normalizeParent(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function list(ctx) {
  const uid = await requireUserId(ctx);
  const groupId = intParam(ctx.url.searchParams.get('groupId'), 'groupId');
  const rows = await query(
    ctx.cfg,
    'SELECT * FROM tab_bookmark WHERE user_id = ? AND group_id = ? ORDER BY sort_order ASC',
    [uid, groupId],
  );
  return okJson(rows.map(toBookmark));
}

async function save(ctx, forcedId = null) {
  const uid = await requireUserId(ctx);
  const body = await readJson(ctx);
  const id = forcedId ?? optionalNumber(body.id);
  const name = String(body.name ?? '').trim();
  if (!name || name.length > 128) throw new BizError('名称长度需在 1-128 之间', 400);

  const type = optionalNumber(body.type) ?? 0;
  const parentId = normalizeParent(body.parentId);
  const iconType = body.iconType || 'favicon';
  const iconValue = body.iconValue ?? null;
  const url = body.url ?? null;
  const sortOrder = optionalNumber(body.sortOrder);

  if (id) {
    const row = await queryOne(ctx.cfg, 'SELECT * FROM tab_bookmark WHERE id = ? LIMIT 1', [id]);
    if (!row || Number(row.user_id) !== uid) throw new BizError('书签不存在', 404);
    await execute(
      ctx.cfg,
      'UPDATE tab_bookmark SET name = ?, url = ?, type = ?, parent_id = ?, icon_type = ?, icon_value = ?, sort_order = ? WHERE id = ?',
      [name, url, type, parentId, iconType, iconValue, sortOrder ?? Number(row.sort_order || 0), id],
    );
    const updated = await queryOne(ctx.cfg, 'SELECT * FROM tab_bookmark WHERE id = ? LIMIT 1', [id]);
    return okJson(toBookmark(updated));
  }

  const groupId = optionalNumber(body.groupId);
  if (groupId === null) throw new BizError('缺少参数 groupId', 400);
  const maxRow = await queryOne(
    ctx.cfg,
    'SELECT MAX(sort_order) AS max_sort FROM tab_bookmark WHERE user_id = ? AND group_id = ?',
    [uid, groupId],
  );
  const nextSort = sortOrder ?? (maxRow && maxRow.max_sort !== null ? Number(maxRow.max_sort) + 1 : 0);
  const result = await execute(
    ctx.cfg,
    'INSERT INTO tab_bookmark (user_id, group_id, parent_id, type, name, url, icon_type, icon_value, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [uid, groupId, parentId, type, name, url, iconType, iconValue, nextSort],
  );
  const created = await queryOne(ctx.cfg, 'SELECT * FROM tab_bookmark WHERE id = ? LIMIT 1', [result.insertId]);
  return okJson(toBookmark(created));
}

async function update(ctx) {
  return save(ctx, intParam(ctx.params.bid, 'bid'));
}

async function remove(ctx) {
  const uid = await requireUserId(ctx);
  const bid = intParam(ctx.params.bid, 'bid');
  const row = await queryOne(ctx.cfg, 'SELECT * FROM tab_bookmark WHERE id = ? LIMIT 1', [bid]);
  if (!row || Number(row.user_id) !== uid) return okJson();

  await transaction(ctx.cfg, async (conn) => {
    if (Number(row.type) === 1) {
      // 文件夹：级联删除直接子项（与 Python 行为一致）
      await conn.execute('DELETE FROM tab_bookmark WHERE user_id = ? AND group_id = ? AND parent_id = ?', [
        uid,
        Number(row.group_id),
        bid,
      ]);
    }
    await conn.execute('DELETE FROM tab_bookmark WHERE id = ?', [bid]);
  });
  return okJson();
}

async function move(ctx) {
  const uid = await requireUserId(ctx);
  const body = await readJson(ctx);
  const id = optionalNumber(body.id);
  if (id === null) throw new BizError('缺少参数 id', 400);

  const row = await queryOne(ctx.cfg, 'SELECT * FROM tab_bookmark WHERE id = ? LIMIT 1', [id]);
  if (!row || Number(row.user_id) !== uid) throw new BizError('书签不存在', 404);

  const groupId = optionalNumber(body.groupId) ?? Number(row.group_id);
  // 与 Python 一致：未传 / 传 0 / 传空 都视为移到顶层
  const parentId = normalizeParent(body.parentId);
  const sortOrder = optionalNumber(body.sortOrder) ?? Number(row.sort_order || 0);

  await execute(ctx.cfg, 'UPDATE tab_bookmark SET group_id = ?, parent_id = ?, sort_order = ? WHERE id = ?', [
    groupId,
    parentId,
    sortOrder,
    id,
  ]);
  return okJson();
}

async function sort(ctx) {
  const uid = await requireUserId(ctx);
  const items = await readJson(ctx);
  if (!Array.isArray(items)) throw new BizError('参数格式错误', 400);

  await transaction(ctx.cfg, async (conn) => {
    for (const item of items) {
      const id = Number(item?.id);
      if (!Number.isFinite(id)) continue;
      const [rows] = await conn.execute('SELECT user_id FROM tab_bookmark WHERE id = ? LIMIT 1', [id]);
      if (!rows.length || Number(rows[0].user_id) !== uid) continue;
      await conn.execute('UPDATE tab_bookmark SET parent_id = ?, sort_order = ? WHERE id = ?', [
        normalizeParent(item.parentId),
        Number(item.sortOrder) || 0,
        id,
      ]);
    }
  });
  return okJson();
}

export const bookmarkRoutes = [
  ['GET', '/api/bookmarks', list],
  ['POST', '/api/bookmarks', (ctx) => save(ctx)],
  ['PUT', '/api/bookmarks/move', move],
  ['PUT', '/api/bookmarks/sort', sort],
  ['PUT', '/api/bookmarks/:bid', update],
  ['DELETE', '/api/bookmarks/:bid', remove],
];
