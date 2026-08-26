import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api'
import type { Bookmark, Group, SearchEngine, TransitionAnimation, UserSetting, Widget } from '@/types'

export const useAppStore = defineStore('app', () => {
  const groups = ref<Group[]>([])
  const currentGroupId = ref<number | null>(null)
  const bookmarks = ref<Bookmark[]>([])
  const widgets = ref<Widget[]>([])
  const settings = ref<UserSetting | null>(null)
  const engines = ref<SearchEngine[]>([])
  /** 是否处于分组切换动画中（供 UI 禁用部分交互） */
  const switching = ref(false)
  /** 数据加载版本号：快速切换时使旧的加载结果失效 */
  const loadToken = ref(0)

  const currentGroup = computed(() => groups.value.find((g) => g.id === currentGroupId.value) || null)
  const defaultEngine = computed(() => engines.value.find((e) => e.isDefault === 1) || engines.value[0] || null)
  /** 书签打开方式：new=新标签页 self=当前页跳转 */
  const bookmarkOpenTarget = computed<'new' | 'self'>(() => settings.value?.bookmarkOpenTarget === 'self' ? 'self' : 'new')
  /** 分组切换过渡动画，默认翻转 */
  const transitionAnimation = computed<TransitionAnimation>(
    () => settings.value?.transitionAnimation || 'flip',
  )

  async function loadAll() {
    const [g, e, s] = await Promise.all([api.groups(), api.engines(), api.settings()])
    groups.value = g
    engines.value = e
    settings.value = s
    if (g.length && !currentGroupId.value) currentGroupId.value = g[0].id
    await loadGroupData()
    applySettings()
  }

  async function loadGroupData() {
    if (!currentGroupId.value) return
    const token = ++loadToken.value
    const [b, w] = await Promise.all([
      api.bookmarks(currentGroupId.value),
      api.widgets(currentGroupId.value),
    ])
    // 快速切换分组时丢弃过期请求结果
    if (token !== loadToken.value) return
    bookmarks.value = b
    widgets.value = w
  }

  /**
   * 切换分组：直接更新 currentGroupId 触发 transition；
   * 数据通过 loadGroupData 拉取，使用 token 防止快速切换错乱。
   */
  async function switchGroup(id: number) {
    if (id === currentGroupId.value) return
    switching.value = true
    currentGroupId.value = id
    // 不 await：动画立即开始，数据到达后自然刷新
    loadGroupData()
  }

  /** 过渡动画结束回调 */
  function finishSwitch() {
    switching.value = false
  }

  function applySettings() {
    const t = settings.value?.theme || 'light'
    const resolved =
      t === 'auto'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : t
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(resolved)
    localStorage.setItem('theme', resolved)
    applyPrimaryColor(settings.value?.primaryColor)
    applyOpacity()
  }

  /**
   * 应用用户设置的透明度：
   * - uiOpacity 影响毛玻璃面板/卡片/输入框背景 alpha
   * - bgOverlayOpacity 影响背景遮罩的不透明度
   * 以 100 为基准（原始视觉效果），向下等比缩放。
   */
  function applyOpacity() {
    const root = document.documentElement
    const isDark = root.classList.contains('dark')
    const ui = clampPercent(settings.value?.uiOpacity)
    const overlay = clampPercent(settings.value?.bgOverlayOpacity)
    const m = ui / 100

    if (isDark) {
      root.style.setProperty('--glass-bg', rgba(22, 32, 54, 0.55 * m))
      root.style.setProperty('--card-bg', rgba(24, 36, 60, 0.62 * m))
      root.style.setProperty('--dock-bg', rgba(18, 28, 48, 0.6 * m))
      root.style.setProperty('--input-bg', rgba(255, 255, 255, 0.08 * m))
    } else {
      root.style.setProperty('--glass-bg', rgba(255, 255, 255, 0.55 * m))
      root.style.setProperty('--card-bg', rgba(255, 255, 255, 0.62 * m))
      root.style.setProperty('--dock-bg', rgba(255, 255, 255, 0.62 * m))
      root.style.setProperty('--input-bg', rgba(255, 255, 255, 0.72 * m))
    }
    root.style.setProperty('--bg-overlay-opacity', String((overlay / 100) * (isDark ? 0.7 : 0.85)))
  }

  function clampPercent(v: number | null | undefined): number {
    if (v == null || Number.isNaN(v)) return 100
    return Math.max(0, Math.min(100, Math.round(v)))
  }

  function rgba(r: number, g: number, b: number, a: number): string {
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, Number(a.toFixed(3))))})`
  }

  /** 应用用户自定义主题色；为空时回退到 CSS 文件默认的 --accent */
  function applyPrimaryColor(color?: string | null) {
    const root = document.documentElement
    if (color && /^#[0-9a-fA-F]{3,8}$|^rgb/i.test(color)) {
      root.style.setProperty('--accent', color)
      root.style.setProperty('--accent-override', color)
    } else {
      root.style.removeProperty('--accent')
      root.style.removeProperty('--accent-override')
    }
  }

  return {
    groups, currentGroupId, currentGroup, bookmarks, widgets, settings, engines,
    switching, defaultEngine, bookmarkOpenTarget, transitionAnimation,
    loadAll, loadGroupData, switchGroup, finishSwitch, applySettings, applyPrimaryColor, applyOpacity,
  }
})
