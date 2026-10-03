<script setup lang="ts">
import { computed, ref } from 'vue'
import { Settings, Sun, Moon, BookmarkPlus, LayoutGrid, RefreshCw, Pencil, Trash2 } from 'lucide-vue-next'
import { useAppStore } from '@/store/app'
import { useUserStore } from '@/store/user'
import { api } from '@/api'
import type { Widget } from '@/types'
import BackgroundLayer from '@/components/BackgroundLayer.vue'
import WeatherEffect from '@/components/WeatherEffect.vue'
import SearchBar from '@/components/SearchBar.vue'
import BookmarkGrid from '@/components/BookmarkGrid.vue'
import WidgetGrid from '@/components/WidgetGrid.vue'
import WidgetEditor from '@/components/WidgetEditor.vue'
import OrbitalDock from '@/components/OrbitalDock.vue'
import SettingsDrawer from '@/components/SettingsDrawer.vue'

const app = useAppStore()
const user = useUserStore()
const settingsOpen = ref(false)
const dockRef = ref<InstanceType<typeof OrbitalDock> | null>(null)
const bookmarkGridRef = ref<InstanceType<typeof BookmarkGrid> | null>(null)
const searchBarRef = ref<InstanceType<typeof SearchBar> | null>(null)

/* ============ 组件编辑 ============ */
const widgetEditorOpen = ref(false)
const widgetEditTarget = ref<Widget | null>(null)

function editWidget(w: Widget) {
  widgetEditTarget.value = w
  widgetEditorOpen.value = true
}
async function onWidgetSaved() {
  widgetEditorOpen.value = false
  widgetEditTarget.value = null
  await app.loadGroupData()
}

/* ============ 全局右键菜单 ============ */
const globalMenu = ref<{ x: number; y: number } | null>(null)

function onContextMenu(e: MouseEvent) {
  const target = e.target as HTMLElement
  // 书签有独立右键菜单，不显示全局菜单
  if (target.closest('.bm')) return
  e.preventDefault()
  globalMenu.value = {
    x: Math.min(e.clientX, window.innerWidth - 180),
    y: Math.min(e.clientY, window.innerHeight - 260),
  }
}
function closeGlobalMenu() {
  globalMenu.value = null
}
function ctxAddBookmark() {
  bookmarkGridRef.value?.addBookmark()
  closeGlobalMenu()
}
function ctxAddWidget() {
  widgetEditTarget.value = null
  widgetEditorOpen.value = true
  closeGlobalMenu()
}
async function ctxRefresh() {
  closeGlobalMenu()
  await app.loadGroupData()
}

/* 重命名 / 删除当前分组（委托给 OrbitalDock） */
function ctxRenameGroup() {
  closeGlobalMenu()
  if (!app.currentGroup) return
  dockRef.value?.showDock()
  // 等 dock 显出后再进入编辑态，避免布局抖动
  setTimeout(() => {
    if (app.currentGroup) {
      dockRef.value?.startEdit(app.currentGroup.id, app.currentGroup.name)
    }
  }, 60)
}
function ctxDeleteGroup() {
  closeGlobalMenu()
  if (app.currentGroup) {
    dockRef.value?.deleteGroup(app.currentGroup.id)
  }
}

async function toggleThemeQuick() {
  const cur = app.settings?.theme === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : (app.settings?.theme || 'light')
  const next = cur === 'dark' ? 'light' : 'dark'
  app.settings = await api.updateSettings({ theme: next })
  app.applySettings()
}

function onGroupEntered() {
  app.finishSwitch()
  // 默认聚焦搜索框；用户显式关闭（autoFocusSearch === 0）或触摸设备（弹键盘会遮住大半屏）时跳过
  if (app.settings?.autoFocusSearch !== 0 && !window.matchMedia('(hover: none)').matches) {
    searchBarRef.value?.focus()
  }
}

/**
 * 当前分组切换使用的 transition 名称。
 * none 时使用瞬间切换的 empty 过渡。
 */
const transitionName = computed(() => {
  switch (app.transitionAnimation) {
    case 'flip': return 'tr-flip'
    case 'stack': return 'tr-stack'
    case 'fade': return 'tr-fade'
    case 'spread': return 'tr-spread'
    case 'zoom': return 'tr-zoom'
    case 'none':
    default: return 'tr-none'
  }
})

</script>

<template>
  <div class="home" @contextmenu="onContextMenu">
    <!-- 背景层 -->
    <BackgroundLayer />

    <!-- 顶部天气特效（雨/雪/大风，每 6 小时最多播放一次） -->
    <WeatherEffect />

    <!-- 顶栏 -->
    <header class="topbar">
      <div class="user-chip">
        <div class="avatar">{{ user.user?.username?.charAt(0).toUpperCase() || '?' }}</div>
        <span class="uname">{{ user.user?.username || 'guest' }}</span>
      </div>
      <div class="top-actions">
        <button class="icon-btn" @click="toggleThemeQuick" title="切换日间/夜间">
          <Sun v-if="app.settings?.theme === 'dark'" :size="18" />
          <Moon v-else :size="18" />
        </button>
        <button class="icon-btn" @click="settingsOpen = true" title="设置">
          <Settings :size="18" />
        </button>
      </div>
    </header>

    <!-- 主内容：分组过渡动画 -->
    <main class="main group-stage" :data-transition="transitionName">
      <transition :name="transitionName" mode="out-in" @after-enter="onGroupEntered">
        <div :key="app.currentGroupId" class="group-page">
          <!-- 搜索栏 -->
          <div class="search-wrap">
            <SearchBar ref="searchBarRef" />
          </div>

          <!-- 组件网格 + 书签网格 -->
          <div class="content">
            <WidgetGrid v-if="app.widgets.length" @edit="editWidget" />
            <BookmarkGrid ref="bookmarkGridRef" />
          </div>
        </div>
      </transition>
    </main>

    <!-- 分组切换器 -->
    <OrbitalDock ref="dockRef" />

    <!-- 设置抽屉 -->
    <SettingsDrawer v-if="settingsOpen" @close="settingsOpen = false" />

    <!-- 组件编辑器 -->
    <WidgetEditor
      v-if="widgetEditorOpen"
      :widget="widgetEditTarget"
      :group-id="app.currentGroupId!"
      @close="widgetEditorOpen = false"
      @saved="onWidgetSaved"
    />

    <!-- 全局右键菜单 -->
    <div v-if="globalMenu" class="ctx-mask" @click="closeGlobalMenu" @contextmenu.prevent="closeGlobalMenu">
      <div class="global-ctx glass" :style="{ left: globalMenu.x + 'px', top: globalMenu.y + 'px' }" @click.stop>
        <button class="gitem" @click="ctxAddBookmark"><BookmarkPlus :size="14" /> 新建书签</button>
        <button class="gitem" @click="ctxAddWidget"><LayoutGrid :size="14" /> 添加组件</button>
        <button class="gitem" @click="ctxRefresh"><RefreshCw :size="14" /> 刷新</button>
        <div class="gsep"></div>
        <button class="gitem" @click="ctxRenameGroup"><Pencil :size="14" /> 重命名分组</button>
        <button class="gitem danger" @click="ctxDeleteGroup"><Trash2 :size="14" /> 删除分组</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  height: 100%;
  height: 100dvh;
  width: 100%;
  position: relative;
  overflow: hidden;
}

/* 顶栏 */
.topbar {
  position: fixed; top: 16px; left: 16px; right: 16px;
  z-index: 30;
  display: flex; align-items: center; justify-content: space-between;
}
.user-chip {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px 6px 6px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(18px) saturate(160%);
  border-radius: 999px;
}
.avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--accent); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 600;
}
.uname { font-size: 13px; font-weight: 500; color: var(--text-primary); }

.top-actions { display: flex; gap: 8px; }
.icon-btn {
  width: 38px; height: 38px; border-radius: 50%;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: blur(18px) saturate(160%);
  color: var(--text-primary);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.icon-btn:hover { transform: translateY(-2px); box-shadow: var(--glass-shadow); }

/* 主区域 */
.main {
  height: 100%; width: 100%;
  display: flex;
  /* 居中交给 .group-page 的 margin:auto：flex 居中在内容超高时会把顶部推出
     滚动区，而溢出方向只有底部可滚，书签多时搜索框会永远点不到 */
  align-items: flex-start;
  justify-content: flex-start;
  padding: 0 20px 80px;
  box-sizing: border-box;
  overflow-y: auto;
}
.group-page {
  margin: auto;
  width: min(1180px, 100%);
  display: flex; flex-direction: column; align-items: center;
  gap: 24px;
  padding-top: 80px;
  padding-bottom: 40px;
}

.search-wrap {
  width: 100%;
  display: flex; justify-content: center;
}

.content {
  width: 100%;
  display: flex; flex-direction: column;
  gap: 20px;
}

/* 移动端：收窄留白，底部给常驻 dock 让位 */
@media (max-width: 640px) {
  .main { padding: 0 12px 90px; }
  .group-page { gap: 16px; padding-top: 64px; padding-bottom: 20px; }
}

/* 全局右键菜单 */
.ctx-mask {
  position: fixed; inset: 0; z-index: 150;
}
.global-ctx {
  position: fixed; z-index: 151;
  min-width: 150px; padding: 4px;
  border-radius: 10px;
  display: flex; flex-direction: column; gap: 2px;
  box-shadow: var(--glass-shadow);
}
.gitem {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border: none; background: transparent;
  color: var(--text-primary); cursor: pointer; font-size: 13px;
  border-radius: 7px; text-align: left; white-space: nowrap;
}
.gitem:hover { background: var(--input-bg); }
.gsep { height: 1px; margin: 4px 6px; background: var(--glass-border); }
.gitem.danger { color: #ff6b6b; }
.gitem.danger:hover { background: rgba(255, 80, 80, 0.15); }
</style>
