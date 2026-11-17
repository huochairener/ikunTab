// /api/groups：分组增删改查 + 排序
import { BizError, okJson, readJson, intParam } from '../http.js';
import { execute, query, queryOne, transaction } from '../db.js';
import { toGroup } from '../mappers.js';
import { requireUserId } from './auth.js';

async function list(ctx) {
  const uid = await requireUserId(ctx);
  const rows = await query(ctx.cfg, 'SELECT * FROM tab_group WHERE user_id = ? ORDER BY sort_order ASC', [uid]);
  return okJson(rows.map(toGroup));
}

async function save(ctx, forcedId = null) {
  const uid = await requireUserId(ctx);
  const body = await readJson(ctx);
  const id = forcedId ?? (body.id ? Number(body.id) : null);
  const name = String(body.name ?? '').trim();
  const icon = body.icon === undefined || body.icon === null ? null : String(body.icon);

  if (!name || name.length > 64) throw new BizError('分组名长度需在 1-64 之间', 400);

  if (id) {
    const row = await queryOne(ctx.cfg, 'SELECT * FROM tab_group WHERE id = ? LIMIT 1', [id]);
    if (!row || Number(row.user_id) !== uid) throw new BizError('分组不存在', 404);
    await execute(ctx.cfg, 'UPDATE tab_group SET name = ?, icon = ? WHERE id = ?', [name, icon ?? row.icon, id]);
    const updated = await queryOne(ctx.cfg, 'SELECT * FROM tab_group WHERE id = ? LIMIT 1', [id]);
    return okJson(toGroup(updated));
  }

  const maxRow = await queryOne(ctx.cfg, 'SELECT MAX(sort_order) AS max_sort FROM tab_group WHERE user_id = ?', [uid]);
  const nextSort = maxRow && maxRow.max_sort !== null ? Number(maxRow.max_sort) + 1 : 0;
  const result = await execute(ctx.cfg, 'INSERT INTO tab_group (user_id, name, icon, sort_order) VALUES (?, ?, ?, ?)', [
    uid,
    name,
    icon || '🌟',
    nextSort,
  ]);
  const created = await queryOne(ctx.cfg, 'SELECT * FROM tab_group WHERE id = ? LIMIT 1', [result.insertId]);
  return okJson(toGroup(created));
}

async function update(ctx) {
  return save(ctx, intParam(ctx.params.gid, 'gid'));
}

async function remove(ctx) {
  const uid = await requireUserId(ctx);
  const gid = intParam(ctx.params.gid, 'gid');
  const row = await queryOne(ctx.cfg, 'SELECT user_id FROM tab_group WHERE id = ? LIMIT 1', [gid]);
  if (!row || Number(row.user_id) !== uid) return okJson();
  await execute(ctx.cfg, 'DELETE FROM tab_group WHERE id = ?', [gid]);
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
      const [rows] = await conn.execute('SELECT user_id FROM tab_group WHERE id = ? LIMIT 1', [id]);
      if (!rows.length || Number(rows[0].user_id) !== uid) continue;
      await conn.execute('UPDATE tab_group SET sort_order = ? WHERE id = ?', [Number(item.sortOrder) || 0, id]);
    }
  });
  return okJson();
}

export const groupRoutes = [
  ['GET', '/api/groups', list],
  ['POST', '/api/groups', (ctx) => save(ctx)],
  ['PUT', '/api/groups/sort', sort],
  ['PUT', '/api/groups/:gid', update],
  ['DELETE', '/api/groups/:gid', remove],
];
