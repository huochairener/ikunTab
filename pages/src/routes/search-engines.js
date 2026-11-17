// /api/search-engines：搜索引擎增删改查（默认引擎唯一）
import { BizError, okJson, readJson, intParam } from '../http.js';
import { execute, query, queryOne, transaction } from '../db.js';
import { toEngine } from '../mappers.js';
import { requireUserId } from './auth.js';

function optionalNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function list(ctx) {
  const uid = await requireUserId(ctx);
  const rows = await query(
    ctx.cfg,
    'SELECT * FROM tab_search_engine WHERE user_id = ? ORDER BY is_default DESC',
    [uid],
  );
  return okJson(rows.map(toEngine));
}

async function markDefault(ctx, uid, engineId) {
  await transaction(ctx.cfg, async (conn) => {
    await conn.execute('UPDATE tab_search_engine SET is_default = 0 WHERE user_id = ? AND id <> ?', [uid, engineId]);
    await conn.execute('UPDATE tab_search_engine SET is_default = 1 WHERE id = ?', [engineId]);
  });
}

async function save(ctx, forcedId = null) {
  const uid = await requireUserId(ctx);
  const body = await readJson(ctx);
  const id = forcedId ?? optionalNumber(body.id);
  const name = String(body.name ?? '').trim();
  const urlTemplate = String(body.urlTemplate ?? '').trim();
  const icon = body.icon === undefined ? null : (body.icon ?? null);
  const isDefault = optionalNumber(body.isDefault) ?? 0;

  if (!name || name.length > 64) throw new BizError('引擎名长度需在 1-64 之间', 400);
  if (!urlTemplate || urlTemplate.length > 512) throw new BizError('搜索地址长度需在 1-512 之间', 400);

  if (id) {
    const row = await queryOne(ctx.cfg, 'SELECT * FROM tab_search_engine WHERE id = ? LIMIT 1', [id]);
    if (!row || Number(row.user_id) !== uid) throw new BizError('搜索引擎不存在', 404);
    await execute(ctx.cfg, 'UPDATE tab_search_engine SET name = ?, url_template = ?, icon = ? WHERE id = ?', [
      name,
      urlTemplate,
      icon,
      id,
    ]);
    if (isDefault === 1) await markDefault(ctx, uid, id);
    const updated = await queryOne(ctx.cfg, 'SELECT * FROM tab_search_engine WHERE id = ? LIMIT 1', [id]);
    return okJson(toEngine(updated));
  }

  const result = await execute(
    ctx.cfg,
    'INSERT INTO tab_search_engine (user_id, name, url_template, icon, is_default) VALUES (?, ?, ?, ?, ?)',
    [uid, name, urlTemplate, icon, isDefault === 1 ? 1 : 0],
  );
  if (isDefault === 1) await markDefault(ctx, uid, result.insertId);
  const created = await queryOne(ctx.cfg, 'SELECT * FROM tab_search_engine WHERE id = ? LIMIT 1', [result.insertId]);
  return okJson(toEngine(created));
}

async function update(ctx) {
  return save(ctx, intParam(ctx.params.eid, 'eid'));
}

async function remove(ctx) {
  const uid = await requireUserId(ctx);
  const eid = intParam(ctx.params.eid, 'eid');
  const row = await queryOne(ctx.cfg, 'SELECT user_id FROM tab_search_engine WHERE id = ? LIMIT 1', [eid]);
  if (!row || Number(row.user_id) !== uid) return okJson();
  await execute(ctx.cfg, 'DELETE FROM tab_search_engine WHERE id = ?', [eid]);
  return okJson();
}

export const searchEngineRoutes = [
  ['GET', '/api/search-engines', list],
  ['POST', '/api/search-engines', (ctx) => save(ctx)],
  ['PUT', '/api/search-engines/:eid', update],
  ['DELETE', '/api/search-engines/:eid', remove],
];
