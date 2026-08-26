import type { Bookmark } from '@/types'

export function domainOf(url?: string): string | null {
  if (!url) return null
  try {
    const u = new URL(url.includes('://') ? url : 'http://' + url)
    let h = u.hostname
    if (h.startsWith('www.')) h = h.slice(4)
    return h
  } catch {
    return null
  }
}

/** 返回书签图标的 src，null 表示用字母占位 */
export function iconUrl(b: Pick<Bookmark, 'iconType' | 'iconValue' | 'url'>): string | null {
  switch (b.iconType) {
    case 'upload':
      return b.iconValue ? b.iconValue : null
    case 'random': {
      if (!b.iconValue) return null
      const sep = b.iconValue.includes('?') ? '&' : '?'
      // 每次刷新都重新获取随机图
      return `${b.iconValue}${sep}t=${Date.now()}`
    }
    case 'favicon': {
      const d = domainOf(b.url)
      return d ? `https://icon.horse/icon/${d}` : null
    }
    default:
      return null
  }
}

export function letter(name: string): string {
  return (name || '?').trim().charAt(0).toUpperCase()
}
