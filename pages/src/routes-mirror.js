// 只读镜像模式的数据接口：全部来自 KV 快照，只允许 GET。
// 任何写操作（POST/PUT/DELETE）统一返回 403「请到主站操作」。
import { BizError, okJson, intParam } from './http.js';
import { toGroup, toBookmark, toSetting, toEngine } from './mappers-mirror.js';
import { loadIndex, listGroups, listBookmarks, findSetting, listSearchEngines } from './mirror.js';
import { mirrorRequireUser } from './auth-mirror.js';
import { createProxyRoutes } from './routes/proxy.js';

async function requireIndex(ctx) {
  const idx = await loadIndex(ctx.cfg);
  if (!idx) throw new BizError('备用站尚未同步数据：请在主站执行一次同步推送', 503);
  return idx;
}

async function listGroupsHandler(ctx) {
  const user = await mirrorRequireUser(ctx);
  const idx = await requireIndex(ctx);
  return okJson(listGroups(idx, user.id).map(toGroup));
}

async function listBookmarksHandler(ctx) {
  const user = await mirrorRequireUser(ctx);
  const idx = await requireIndex(ctx);
  const groupId = intParam(ctx.url.searchParams.get('groupId'), 'groupId');
  return okJson(listBookmarks(idx, user.id, groupId).map(toBookmark));
}

async function getSettingHandler(ctx) {
  const user = await mirrorRequireUser(ctx);
  const idx = await requireIndex(ctx);
  const setting = findSetting(idx, user.id);
  return okJson(setting ? toSetting(setting) : null);
}

async function listSearchEnginesHandler(ctx) {
  const user = await mirrorRequireUser(ctx);
  const idx = await requireIndex(ctx);
  return okJson(listSearchEngines(idx, user.id).map(toEngine));
}

async function listWidgetsHandler(ctx) {
  // 备用站不实现挂件，但要求已登录，避免未登录也能探接口
  await mirrorRequireUser(ctx);
  return okJson([]);
}

/** 只读：所有变更操作拒绝 */
function readonly() {
  throw new BizError('备用站为只读镜像，请到主站操作', 403);
}

/**
 * 覆盖式注册：镜像模式下这些路径**全部**先登记为只读拒绝，
 * 然后单独放行只读的 GET。这样即使主站的写接口路径很多，
 * 也不会出现漏网的可写接口。
 */
export const mirrorRoutes = [
  // 分组
  ['GET', '/api/groups', listGroupsHandler],
  ['POST', '/api/groups', readonly],
  ['PUT', '/api/groups/sort', readonly],
  ['PUT', '/api/groups/:id', readonly],
  ['DELETE', '/api/groups/:id', readonly],

  // 书签
  ['GET', '/api/bookmarks', listBookmarksHandler],
  ['POST', '/api/bookmarks', readonly],
  ['PUT', '/api/bookmarks/move', readonly],
  ['PUT', '/api/bookmarks/sort', readonly],
  ['PUT', '/api/bookmarks/:id', readonly],
  ['DELETE', '/api/bookmarks/:id', readonly],

  // 设置
  ['GET', '/api/settings', getSettingHandler],
  ['PUT', '/api/settings', readonly],

  // 搜索引擎
  ['GET', '/api/search-engines', listSearchEnginesHandler],
  ['POST', '/api/search-engines', readonly],
  ['PUT', '/api/search-engines/:id', readonly],
  ['DELETE', '/api/search-engines/:id', readonly],

  // 小组件：备用站明确不实现（需求：无需挂件），但保留读接口返回空数组
  ['GET', '/api/widgets', listWidgetsHandler],
  ['POST', '/api/widgets', readonly],
  ['PUT', '/api/widgets/move', readonly],
  ['PUT', '/api/widgets/:id', readonly],
  ['DELETE', '/api/widgets/:id', readonly],

  // 上传：备用站没有持久化磁盘，直接拒绝
  ['POST', '/api/upload', readonly],
];

/**
 * 镜像模式下也完全可用的**无状态**接口：favicon / weather / hotlist。
 * 它们不碰数据库也不依赖主站存活（直接调第三方），与镜像数据无关，
 * 因此直接复用 proxy.js 的实现，避免备用站首页缺图标/天气/热榜。
 */
export function mirrorStatelessRoutes(cfg) {
  return createProxyRoutes(cfg);
}
