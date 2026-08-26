export interface User { id: number; username: string; email?: string; avatar?: string }

export interface Group { id: number; name: string; icon: string; sortOrder: number }

export interface Bookmark {
  id: number
  groupId: number
  parentId: number | null
  type: number            // 0 书签 1 文件夹
  name: string
  url?: string
  iconType: 'favicon' | 'upload' | 'random' | 'default'
  iconValue?: string
  sortOrder: number
}

export interface Widget {
  id: number
  groupId: number
  type: 'hotlist' | 'weather' | 'clock' | 'calendar' | 'countdown' | 'custom'
  name?: string
  rows: number
  cols: number
  config: string          // JSON 字符串
  sortOrder: number
  x?: number              // 栅格横坐标（列偏移）
  y?: number              // 栅格纵坐标（行偏移）
  enabled: number
}

export interface SearchEngine {
  id: number
  name: string
  urlTemplate: string
  icon?: string
  isDefault: number
}

export type TransitionAnimation = 'flip' | 'stack' | 'fade' | 'spread' | 'zoom' | 'none'

export interface UserSetting {
  id: number
  theme: 'light' | 'dark' | 'auto'
  searchEngineId: number | null
  backgroundType: 'upload' | 'random' | 'bing'
  backgroundValue?: string
  backgroundAnimation?: number      // 0=关闭 1=开启浮动动效
  bookmarkOpenTarget?: 'new' | 'self'  // new=新标签页打开 self=当前页跳转
  autoFocusSearch?: number         // 0=关闭 1=页面加载后自动聚焦搜索框
  transitionAnimation?: TransitionAnimation  // 分组切换过渡动画
  primaryColor?: string | null                // 用户自定义主题色（CSS 颜色值，空则使用默认）
  uiOpacity?: number                          // 界面毛玻璃透明度百分比 0-100
  bgOverlayOpacity?: number                   // 背景遮罩透明度百分比 0-100
}

export interface CustomWidgetConfig {
  outerUrl: string
  clickBehavior: 'iframe' | 'popup' | 'none'
  popupUrl?: string
}
export interface HotlistConfig { source: string }
export interface CountdownConfig { name: string; date: string }
export interface WeatherConfig { city?: string }
export interface ClockConfig { format?: '12' | '24' }
