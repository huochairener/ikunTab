// 数据库行 → API 返回结构（与 Python schemas 的字段命名完全一致）

const num = (v) => (v === null || v === undefined ? 0 : Number(v));
const numOrNone = (v) => (v === null || v === undefined ? null : Number(v));
const strOrNone = (v) => (v === null || v === undefined ? null : String(v));

export function toUser(row) {
  return {
    id: num(row.id),
    username: row.username,
    email: strOrNone(row.email),
    avatar: strOrNone(row.avatar),
  };
}

export function toGroup(row) {
  return {
    id: num(row.id),
    userId: num(row.user_id),
    name: row.name,
    icon: row.icon ?? '',
    sortOrder: num(row.sort_order),
  };
}

export function toBookmark(row) {
  return {
    id: num(row.id),
    userId: num(row.user_id),
    groupId: num(row.group_id),
    parentId: numOrNone(row.parent_id),
    type: num(row.type),
    name: row.name,
    url: strOrNone(row.url),
    iconType: row.icon_type || 'favicon',
    iconValue: strOrNone(row.icon_value),
    sortOrder: num(row.sort_order),
  };
}

export function toWidget(row) {
  return {
    id: num(row.id),
    userId: num(row.user_id),
    groupId: num(row.group_id),
    type: row.type,
    name: strOrNone(row.name),
    rows: num(row.rows) || 1,
    cols: num(row.cols) || 1,
    config: strOrNone(row.config),
    sortOrder: num(row.sort_order),
    x: num(row.x),
    y: num(row.y),
    enabled: row.enabled === null || row.enabled === undefined ? 1 : num(row.enabled),
  };
}

export function toSetting(row) {
  return {
    id: num(row.id),
    userId: num(row.user_id),
    theme: row.theme || 'light',
    searchEngineId: numOrNone(row.search_engine_id),
    backgroundType: row.background_type || 'bing',
    backgroundValue: strOrNone(row.background_value),
    backgroundAnimation: num(row.background_animation),
    bookmarkOpenTarget: row.bookmark_open_target || 'new',
    autoFocusSearch: row.auto_focus_search === null || row.auto_focus_search === undefined ? 1 : num(row.auto_focus_search),
    transitionAnimation: row.transition_animation || 'flip',
    primaryColor: strOrNone(row.primary_color),
    uiOpacity: row.ui_opacity === null || row.ui_opacity === undefined ? 100 : num(row.ui_opacity),
    bgOverlayOpacity: row.bg_overlay_opacity === null || row.bg_overlay_opacity === undefined ? 100 : num(row.bg_overlay_opacity),
  };
}

export function toEngine(row) {
  return {
    id: num(row.id),
    userId: num(row.user_id),
    name: row.name,
    urlTemplate: row.url_template,
    icon: strOrNone(row.icon),
    isDefault: num(row.is_default),
  };
}
