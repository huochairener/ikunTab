// 镜像模式的 mapper：KV 快照里存的是 camelCase，与 db.js 的 snake_case 行结构不同，
// 所以不能复用 mappers.js（那套按 row.user_id / row.group_id 读，KV 里没有这些字段，
// 直接复用会导致 userId/groupId 全部变成 0）。
// 这里把 KV 对象原样规整成 API 返回结构，并补齐缺省值。

const num = (v) => (v === null || v === undefined ? 0 : Number(v));
const numOrNone = (v) => (v === null || v === undefined ? null : Number(v));
const strOrNone = (v) => (v === null || v === undefined ? null : String(v));

export function toGroup(row) {
  return {
    id: num(row.id),
    userId: num(row.userId),
    name: row.name ?? '',
    icon: row.icon ?? '',
    sortOrder: num(row.sortOrder),
  };
}

export function toBookmark(row) {
  return {
    id: num(row.id),
    userId: num(row.userId),
    groupId: num(row.groupId),
    parentId: numOrNone(row.parentId),
    type: num(row.type),
    name: row.name ?? '',
    url: strOrNone(row.url),
    iconType: row.iconType || 'favicon',
    iconValue: strOrNone(row.iconValue),
    sortOrder: num(row.sortOrder),
  };
}

export function toSetting(row) {
  return {
    id: num(row.id),
    userId: num(row.userId),
    theme: row.theme || 'light',
    searchEngineId: numOrNone(row.searchEngineId),
    backgroundType: row.backgroundType || 'bing',
    backgroundValue: strOrNone(row.backgroundValue),
    backgroundAnimation: num(row.backgroundAnimation),
    bookmarkOpenTarget: row.bookmarkOpenTarget || 'new',
    autoFocusSearch: row.autoFocusSearch === null || row.autoFocusSearch === undefined ? 1 : num(row.autoFocusSearch),
    transitionAnimation: row.transitionAnimation || 'flip',
    primaryColor: strOrNone(row.primaryColor),
    uiOpacity: row.uiOpacity === null || row.uiOpacity === undefined ? 100 : num(row.uiOpacity),
    bgOverlayOpacity:
      row.bgOverlayOpacity === null || row.bgOverlayOpacity === undefined ? 100 : num(row.bgOverlayOpacity),
  };
}

export function toEngine(row) {
  return {
    id: num(row.id),
    userId: num(row.userId),
    name: row.name ?? '',
    urlTemplate: row.urlTemplate ?? '',
    icon: strOrNone(row.icon),
    isDefault: num(row.isDefault),
  };
}
