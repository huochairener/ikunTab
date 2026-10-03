import { http } from './http'
import type { Bookmark, Group, SearchEngine, User, UserSetting, Widget } from '@/types'

export const api = {
  // auth
  register: (data: { username: string; password: string; email?: string }) =>
    http.post<User>('/auth/register', data).then((r) => r.data),
  login: (data: { username: string; password: string }) =>
    http.post<User>('/auth/login', data).then((r) => r.data),
  logout: () => http.post('/auth/logout').then((r) => r.data),
  me: () => http.get<User>('/auth/me').then((r) => r.data),
  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    http.post('/auth/change-password', data).then((r) => r.data),

  // groups
  groups: () => http.get<Group[]>('/groups').then((r) => r.data),
  saveGroup: (data: Partial<Group>) => http.post<Group>('/groups', data).then((r) => r.data),
  updateGroup: (id: number, data: Partial<Group>) => http.put<Group>(`/groups/${id}`, data).then((r) => r.data),
  deleteGroup: (id: number) => http.delete(`/groups/${id}`),
  sortGroups: (items: { id: number; sortOrder: number }[]) => http.put('/groups/sort', items),

  // bookmarks
  bookmarks: (groupId: number) => http.get<Bookmark[]>('/bookmarks', { params: { groupId } }).then((r) => r.data),
  saveBookmark: (data: any) => http.post<Bookmark>('/bookmarks', data).then((r) => r.data),
  updateBookmark: (id: number, data: any) => http.put<Bookmark>(`/bookmarks/${id}`, data).then((r) => r.data),
  deleteBookmark: (id: number) => http.delete(`/bookmarks/${id}`),
  moveBookmark: (data: any) => http.put('/bookmarks/move', data),
  sortBookmarks: (items: { id: number; parentId?: number | null; sortOrder: number }[]) =>
    http.put('/bookmarks/sort', items),

  // widgets
  widgets: (groupId: number) => http.get<Widget[]>('/widgets', { params: { groupId } }).then((r) => r.data),
  saveWidget: (data: any) => http.post<Widget>('/widgets', data).then((r) => r.data),
  updateWidget: (id: number, data: any) => http.put<Widget>(`/widgets/${id}`, data).then((r) => r.data),
  deleteWidget: (id: number) => http.delete(`/widgets/${id}`),
  /** 批量保存布局（x/y/cols/rows/sortOrder） */
  layoutWidgets: (items: { id: number; x?: number; y?: number; cols?: number; rows?: number; sortOrder?: number }[]) =>
    http.put('/widgets/move', items).then((r) => r.data),

  // settings
  settings: () => http.get<UserSetting>('/settings').then((r) => r.data),
  updateSettings: (data: any) => http.put<UserSetting>('/settings', data).then((r) => r.data),

  // search engines
  engines: () => http.get<SearchEngine[]>('/search-engines').then((r) => r.data),
  saveEngine: (data: any) => http.post<SearchEngine>('/search-engines', data).then((r) => r.data),
  updateEngine: (id: number, data: any) => http.put<SearchEngine>(`/search-engines/${id}`, data).then((r) => r.data),
  deleteEngine: (id: number) => http.delete(`/search-engines/${id}`),

  // proxy
  favicon: (url: string) => http.get<{ url: string }>('/favicon', { params: { url } }).then((r) => r.data.url),
  weather: (city?: string, lat?: number, lon?: number) =>
    http.get<string>('/weather', { params: { city, lat, lon } }).then((r) => r.data),
  hotlist: (source: string) => http.get<string>('/hotlist', { params: { source } }).then((r) => r.data),

  // upload
  upload: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return http.post<{ url: string }>('/upload', fd).then((r) => r.data.url)
  },
}
