<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Plus, Check, X } from 'lucide-vue-next'
import { useAppStore } from '@/store/app'
import { api } from '@/api'

const app = useAppStore()
const dockHover = ref(false)
const hideTimer = ref<number | null>(null)
const editingId = ref<number | null>(null)
const editingName = ref('')
const showAddInput = ref(false)
const newName = ref('')

const currentIdx = computed(() =>
  app.groups.findIndex((g) => g.id === app.currentGroupId),
)

/* ============ 自动隐藏 ============ */
function showDock() {
  dockHover.value = true
  if (hideTimer.value) window.clearTimeout(hideTimer.value)
  hideTimer.value = window.setTimeout(() => {
    if (!dockHover.value) return
    dockHover.value = false
  }, 2400)
}

function keepDock() {
  if (hideTimer.value) window.clearTimeout(hideTimer.value)
}

/* ============ 切换分组 ============ */
async function switchTo(idx: number) {
  if (idx < 0 || idx >= app.groups.length) return
  const g = app.groups[idx]
  if (g.id === app.currentGroupId) return
  await app.switchGroup(g.id)
}

async function switchByDelta(delta: number) {
  if (!app.groups.length) return
  const next = (currentIdx.value + delta + app.groups.length) % app.groups.length
  await switchTo(next)
}

/* ============ 滚轮切换 ============ */
let wheelLock = false
// 弹窗/遮罩层/组件：滚轮发生在这些元素内时不切换分组，让内部正常滚动
const OVERLAY_SELECTOR = '.mask, .modal-mask, .popup-mask, .ctx-mask, .modal, .drawer'
const MODAL_SELECTOR = OVERLAY_SELECTOR + ', .widget'
/** 滚轮方向上页面还能不能滚 */
function canScrollIn(el: HTMLElement, deltaY: number) {
  const max = el.scrollHeight - el.clientHeight
  if (max <= 1) return false
  if (deltaY > 0) return el.scrollTop < max - 1
  if (deltaY < 0) return el.scrollTop > 1
  return false
}
function onWheel(e: WheelEvent) {
  const target = e.target as HTMLElement | null
  if (target?.closest?.(MODAL_SELECTOR)) return
  // 指针在页面内且该方向还能滚：先让浏览器滚页，滚到边界才切分组
  const scroller = document.querySelector<HTMLElement>('.main')
  if (scroller && target && scroller.contains(target) && canScrollIn(scroller, e.deltaY)) return
  e.preventDefault()
  if (wheelLock) return
  wheelLock = true
  showDock()
  switchByDelta(e.deltaY > 0 ? 1 : -1).finally(() => {
    // 与新的过渡时长（约 0.32s）匹配，避免动画未结束时被阻塞
    setTimeout(() => (wheelLock = false), 260)
  })
}

/* ============ 触摸左右滑动切换（整屏） ============ */
const SWIPE_MIN_X = 60
// 起手势距屏幕左右边缘太近会撞上车/浏览器返回手势，直接放弃识别
const EDGE_ZONE = 28
let touchStartX = 0
let touchStartY = 0
let touchActive = false
let swipeLock = false
function onTouchStart(e: TouchEvent) {
  if (e.touches.length !== 1) {
    touchActive = false
    return
  }
  const target = e.target as HTMLElement | null
  const x = e.touches[0].clientX
  // 组件区没有横向滚动，允许在组件上横滑，只排除弹窗/遮罩
  if (swipeLock || target?.closest?.(OVERLAY_SELECTOR)) {
    touchActive = false
    return
  }
  touchActive = x > EDGE_ZONE && x < window.innerWidth - EDGE_ZONE
  touchStartX = x
  touchStartY = e.touches[0].clientY
}
function onTouchEnd(e: TouchEvent) {
  if (!touchActive) return
  touchActive = false
  const t = e.changedTouches[0]
  const dx = t.clientX - touchStartX
  const dy = t.clientY - touchStartY
  // 横向位移明显占主导才算切组，斜向滚动不误触
  if (Math.abs(dx) < SWIPE_MIN_X || Math.abs(dx) < Math.abs(dy) * 1.4) return
  swipeLock = true
  setTimeout(() => (swipeLock = false), 450)
  showDock()
  switchByDelta(dx < 0 ? 1 : -1)
}
function onTouchCancel() {
  touchActive = false
}

/* ============ 键盘快捷键 Alt+1~9 ============ */
function onKey(e: KeyboardEvent) {
  if (!e.altKey) return
  const n = parseInt(e.key, 10)
  if (n >= 1 && n <= 9) {
    e.preventDefault()
    switchTo(n - 1)
    showDock()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('wheel', onWheel, { passive: false })
  // 鼠标移到底部区域唤起
  window.addEventListener('mousemove', onMouseMove)
  // 整屏左右滑动切组：passive 保证纵向滚动不受影响
  window.addEventListener('touchstart', onTouchStart, { passive: true })
  window.addEventListener('touchend', onTouchEnd, { passive: true })
  window.addEventListener('touchcancel', onTouchCancel)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('wheel', onWheel)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('touchstart', onTouchStart)
  window.removeEventListener('touchend', onTouchEnd)
  window.removeEventListener('touchcancel', onTouchCancel)
})

function onMouseMove(e: MouseEvent) {
  // 鼠标进入屏幕底部 100px 范围唤起
  if (e.clientY > window.innerHeight - 100) {
    showDock()
  }
}

/* ============ 编辑分组 ============ */
function startEdit(id: number, name: string) {
  keepDock()
  editingId.value = id
  editingName.value = name
}
async function confirmEdit() {
  if (!editingId.value) return
  await api.updateGroup(editingId.value, { name: editingName.value })
  const g = app.groups.find((x) => x.id === editingId.value)
  if (g) g.name = editingName.value
  editingId.value = null
}
function cancelEdit() {
  editingId.value = null
}
async function deleteGroup(id: number) {
  if (app.groups.length <= 1) {
    alert('至少保留一个分组')
    return
  }
  if (!confirm('删除该分组及其所有书签和组件？')) return
  await api.deleteGroup(id)
  app.groups = app.groups.filter((g) => g.id !== id)
  if (app.currentGroupId === id) {
    app.currentGroupId = app.groups[0]?.id ?? null
    if (app.currentGroupId) await app.loadGroupData()
  }
}
async function addGroup() {
  if (!newName.value.trim()) return
  const g = await api.saveGroup({
    name: newName.value.trim(),
    icon: '📁',
    sortOrder: app.groups.length,
  })
  app.groups.push(g)
  newName.value = ''
  showAddInput.value = false
}

defineExpose({ showDock, startEdit, deleteGroup })
</script>

<template>
  <div
    class="dock-wrap"
    :class="{ hovered: dockHover }"
    @mouseenter="keepDock"
    @mouseleave="showDock"
  >
    <div class="dock-arc">
      <div class="dock-inner glass">
        <!-- 当前组名提示 -->
        <transition name="fade">
          <div v-if="!editingId" class="current-tag">
            <span class="current-idx">{{ currentIdx + 1 }}</span>
            <span class="current-name">{{ app.currentGroup?.name || '' }}</span>
          </div>
        </transition>

        <!-- 编辑态 -->
        <div v-if="editingId" class="edit-row">
          <input
            v-model="editingName"
            class="input"
            placeholder="分组名称"
            @keydown.enter="confirmEdit"
            @keydown.esc="cancelEdit"
          />
          <button class="mini ok" @click="confirmEdit"><Check :size="14" /></button>
          <button class="mini" @click="cancelEdit"><X :size="14" /></button>
        </div>

        <!-- 添加分组态 -->
        <div v-else-if="showAddInput" class="edit-row">
          <input
            v-model="newName"
            class="input"
            placeholder="新分组名称"
            @keydown.enter="addGroup"
            @keydown.esc="showAddInput = false"
          />
          <button class="mini ok" @click="addGroup"><Check :size="14" /></button>
          <button class="mini" @click="showAddInput = false"><X :size="14" /></button>
        </div>

        <!-- 默认态：轨道按钮 -->
        <div v-else class="orbit" @wheel.prevent="onWheel">
          <button
            v-for="(g, i) in app.groups"
            :key="g.id"
            class="orbit-item"
            :class="{ on: g.id === app.currentGroupId, prev: i === currentIdx - 1, next: i === currentIdx + 1 }"
            :style="{ '--idx': i - currentIdx }"
            @click="switchTo(i)"
            @contextmenu.prevent="startEdit(g.id, g.name)"
          >
            <span class="dot">{{ g.icon || g.name.charAt(0) }}</span>
            <span class="tip">{{ g.name }}</span>
          </button>

          <!-- 添加按钮 -->
          <button class="orbit-item add" @click="showAddInput = true">
            <Plus :size="16" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dock-wrap {
  position: fixed; left: 50%; bottom: 18px;
  transform: translateX(-50%) translateY(80px);
  z-index: 50;
  opacity: 0;
  transition: transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.3s;
  pointer-events: none;
}
.dock-wrap.hovered {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
  pointer-events: auto;
}
/* 触摸设备没有 mousemove/hover 来唤起 dock，改为常驻，否则无法切换分组 */
@media (hover: none) {
  .dock-wrap {
    opacity: 1;
    transform: translateX(-50%);
    pointer-events: auto;
  }
}
.dock-arc {
  position: relative;
  perspective: 1200px;
}
.dock-inner {
  position: relative;
  min-width: 320px;
  padding: 10px 14px;
  border-radius: 999px;
  display: flex; align-items: center; gap: 12px;
  transform-style: preserve-3d;
}

/* 当前组名标签 */
.current-tag {
  display: flex; align-items: center; gap: 6px;
  padding-right: 12px;
  border-right: 1px solid var(--glass-border);
}
.current-idx {
  display: flex; align-items: center; justify-content: center;
  width: 22px; height: 22px;
  background: var(--accent); color: #fff;
  border-radius: 50%; font-size: 11px; font-weight: 600;
}
.current-name {
  font-size: 13px; font-weight: 500;
  color: var(--text-primary);
  max-width: 100px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* 轨道 */
.orbit {
  display: flex; align-items: center; gap: 4px;
}
.orbit-item {
  position: relative;
  width: 36px; height: 36px;
  border: none; background: transparent;
  cursor: pointer; padding: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  transition: all 0.25s cubic-bezier(0.22, 0.61, 0.36, 1);
  transform: translateZ(0);
}
.orbit-item .dot {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--input-bg); color: var(--text-secondary);
  font-size: 13px;
  transition: all 0.25s;
}
.orbit-item .tip {
  position: absolute; bottom: -28px; left: 50%;
  transform: translateX(-50%) translateY(-4px);
  background: var(--text-primary); color: var(--bg-base);
  font-size: 10px; padding: 2px 6px; border-radius: 4px;
  opacity: 0; pointer-events: none; transition: opacity 0.15s, transform 0.15s;
  white-space: nowrap;
}
.orbit-item:hover .tip {
  opacity: 1; transform: translateX(-50%) translateY(0);
}
.orbit-item.on .dot {
  background: var(--accent); color: #fff;
  transform: scale(1.15);
  box-shadow: 0 4px 12px rgba(31, 182, 166, 0.45);
}
.orbit-item.prev .dot,
.orbit-item.next .dot {
  opacity: 0.7;
}
.orbit-item.add .dot {
  background: transparent; border: 1.5px dashed var(--glass-border);
  color: var(--text-secondary);
}
.orbit-item.add:hover .dot {
  border-color: var(--accent); color: var(--accent);
}

/* 编辑态 */
.edit-row {
  display: flex; align-items: center; gap: 6px;
}
.edit-row .input { width: 130px; padding: 5px 10px; font-size: 13px; }
.mini {
  width: 28px; height: 28px; border-radius: 50%;
  border: none; background: var(--input-bg); color: var(--text-secondary);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.mini.ok { background: var(--accent); color: #fff; }
.mini:hover { filter: brightness(1.1); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(4px); }
</style>
