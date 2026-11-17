// /api/settings：用户设置读写（不存在时自动创建默认行）
import { okJson, readJson } from '../http.js';
import { execute, queryOne } from '../db.js';
import { toSetting } from '../mappers.js';
import { requireUserId } from './auth.js';

function clampOpacity(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.trunc(n)));
}

async function loadOrCreate(ctx, uid) {
  const existing = await queryOne(ctx.cfg, 'SELECT * FROM tab_user_setting WHERE user_id = ? LIMIT 1', [uid]);
  if (existing) return existing;

  await execute(
    ctx.cfg,
    `INSERT INTO tab_user_setting
       (user_id, theme, background_type, background_animation, bookmark_open_target,
        auto_focus_search, transition_animation, ui_opacity, bg_overlay_opacity)
     VALUES (?, 'light', 'bing', 0, 'new', 1, 'flip', 100, 100)`,
    [uid],
  );
  const created = await queryOne(ctx.cfg, 'SELECT * FROM tab_user_setting WHERE user_id = ? LIMIT 1', [uid]);
  return created;
}

async function get(ctx) {
  const uid = await requireUserId(ctx);
  const row = await loadOrCreate(ctx, uid);
  return okJson(toSetting(row));
}

async function update(ctx) {
  const uid = await requireUserId(ctx);
  const body = await readJson(ctx);
  const row = await loadOrCreate(ctx, uid);

  const next = {
    theme: body.theme ?? row.theme,
    searchEngineId: body.searchEngineId === undefined ? row.search_engine_id : body.searchEngineId,
    backgroundType: body.backgroundType ?? row.background_type,
    backgroundValue: body.backgroundValue === undefined ? row.background_value : body.backgroundValue,
    backgroundAnimation: body.backgroundAnimation === undefined ? row.background_animation : Number(body.backgroundAnimation),
    bookmarkOpenTarget: body.bookmarkOpenTarget ?? row.bookmark_open_target,
    autoFocusSearch: body.autoFocusSearch === undefined ? row.auto_focus_search : Number(body.autoFocusSearch),
    transitionAnimation: body.transitionAnimation ?? row.transition_animation,
    primaryColor: body.primaryColor === undefined ? row.primary_color : (body.primaryColor || null),
    uiOpacity: clampOpacity(body.uiOpacity === undefined ? row.ui_opacity : body.uiOpacity, 100),
    bgOverlayOpacity: clampOpacity(
      body.bgOverlayOpacity === undefined ? row.bg_overlay_opacity : body.bgOverlayOpacity,
      100,
    ),
  };

  await execute(
    ctx.cfg,
    `UPDATE tab_user_setting SET
       theme = ?, search_engine_id = ?, background_type = ?, background_value = ?,
       background_animation = ?, bookmark_open_target = ?, auto_focus_search = ?,
       transition_animation = ?, primary_color = ?, ui_opacity = ?, bg_overlay_opacity = ?
     WHERE user_id = ?`,
    [
      next.theme,
      next.searchEngineId === null ? null : Number(next.searchEngineId),
      next.backgroundType,
      next.backgroundValue,
      next.backgroundAnimation,
      next.bookmarkOpenTarget,
      next.autoFocusSearch,
      next.transitionAnimation,
      next.primaryColor,
      next.uiOpacity,
      next.bgOverlayOpacity,
      uid,
    ],
  );

  const updated = await queryOne(ctx.cfg, 'SELECT * FROM tab_user_setting WHERE user_id = ? LIMIT 1', [uid]);
  return okJson(toSetting(updated));
}

export const settingRoutes = [
  ['GET', '/api/settings', get],
  ['PUT', '/api/settings', update],
];
