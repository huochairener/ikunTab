// /api/widgets：小组件增删改查 + 栅格布局保存
// 注意：`rows` 是 MySQL 保留字，SQL 里必须加反引号
import { BizError, okJson, readJson, intParam } from '../http.js';
import { execute, query, queryOne, transaction } from '../db.js';
import { toWidget } from '../mappers.js';
import { requireUserId } from './auth.js';

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
    'SELECT * FROM tab_widget WHERE user_id = ? AND group_id = ? ORDER BY sort_order ASC',
    [uid, groupId],
  );
  return okJson(rows.map(toWidget));
}

async function save(ctx, forcedId = null) {
  const uid = await requireUserId(ctx);
  const body = await readJson(ctx);
  const id = forcedId ?? optionalNumber(body.id);
  const type = String(body.type ?? '').trim();
  if (!type || type.length > 32) throw new BizError('组件类型不合法', 400);

  const name = body.name === undefined ? null : (body.name ?? null);
  const rowsCount = optionalNumber(body.rows) ?? 1;
  const colsCount = optionalNumber(body.cols) ?? 1;
  const config = body.config ?? null;
  const enabled = optionalNumber(body.enabled);
  const sortOrder = optionalNumber(body.sortOrder);
  const x = optionalNumber(body.x);
  const y = optionalNumber(body.y);

  if (id) {
    const row = await queryOne(ctx.cfg, 'SELECT * FROM tab_widget WHERE id = ? LIMIT 1', [id]);
    if (!row || Number(row.user_id) !== uid) throw new BizError('组件不存在', 404);

    await execute(
      ctx.cfg,
      'UPDATE tab_widget SET type = ?, name = ?, `rows` = ?, cols = ?, config = ?, enabled = ?, sort_order = ?, x = ?, y = ? WHERE id = ?',
      [
        type,
        name,
        rowsCount,
        colsCount,
        config,
        enabled ?? Number(row.enabled ?? 1),
        sortOrder ?? Number(row.sort_order || 0),
        x ?? Number(row.x || 0),
        y ?? Number(row.y || 0),
        id,
      ],
    );
    const updated = await queryOne(ctx.cfg, 'SELECT * FROM tab_widget WHERE id = ? LIMIT 1', [id]);
    return okJson(toWidget(updated));
  }

  const groupId = optionalNumber(body.groupId);
  if (groupId === null) throw new BizError('缺少参数 groupId', 400);

  // 新组件默认追加到布局末尾（与 Python 一致：max(y + rows)）
  const stats = await query(
    ctx.cfg,
    'SELECT `rows`, y, sort_order FROM tab_widget WHERE user_id = ? AND group_id = ?',
    [uid, groupId],
  );
  let maxSort = -1;
  let maxY = 0;
  for (const item of stats) {
    maxSort = Math.max(maxSort, Number(item.sort_order || 0));
    maxY = Math.max(maxY, Number(item.y || 0) + Number(item.rows || 1));
  }

  const result = await execute(
    ctx.cfg,
    'INSERT INTO tab_widget (user_id, group_id, type, name, `rows`, cols, config, sort_order, x, y, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      uid,
      groupId,
      type,
      name,
      rowsCount,
      colsCount,
      config,
      sortOrder ?? maxSort + 1,
      x ?? 0,
      y ?? maxY,
      enabled ?? 1,
    ],
  );
  const created = await queryOne(ctx.cfg, 'SELECT * FROM tab_widget WHERE id = ? LIMIT 1', [result.insertId]);
  return okJson(toWidget(created));
}

async function update(ctx) {
  return save(ctx, intParam(ctx.params.wid, 'wid'));
}

async function remove(ctx) {
  const uid = await requireUserId(ctx);
  const wid = intParam(ctx.params.wid, 'wid');
  const row = await queryOne(ctx.cfg, 'SELECT user_id FROM tab_widget WHERE id = ? LIMIT 1', [wid]);
  if (!row || Number(row.user_id) !== uid) return okJson();
  await execute(ctx.cfg, 'DELETE FROM tab_widget WHERE id = ?', [wid]);
  return okJson();
}

async function layout(ctx) {
  const uid = await requireUserId(ctx);
  const items = await readJson(ctx);
  if (!Array.isArray(items)) throw new BizError('参数格式错误', 400);

  await transaction(ctx.cfg, async (conn) => {
    for (const item of items) {
      const id = Number(item?.id);
      if (!Number.isFinite(id)) continue;
      const [rows] = await conn.execute('SELECT user_id FROM tab_widget WHERE id = ? LIMIT 1', [id]);
      if (!rows.length || Number(rows[0].user_id) !== uid) continue;

      const sets = [];
      const params = [];
      for (const [key, column] of [
        ['sortOrder', 'sort_order'],
        ['x', 'x'],
        ['y', 'y'],
        ['cols', 'cols'],
        ['rows', '`rows`'],
      ]) {
        const value = optionalNumber(item[key]);
        if (value === null) continue;
        sets.push(`${column} = ?`);
        params.push(value);
      }
      if (!sets.length) continue;
      params.push(id);
      await conn.execute(`UPDATE tab_widget SET ${sets.join(', ')} WHERE id = ?`, params);
    }
  });
  return okJson();
}

export const widgetRoutes = [
  ['GET', '/api/widgets', list],
  ['POST', '/api/widgets', (ctx) => save(ctx)],
  ['PUT', '/api/widgets/move', layout],
  ['PUT', '/api/widgets/:wid', update],
  ['DELETE', '/api/widgets/:wid', remove],
];
