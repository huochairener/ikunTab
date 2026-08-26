<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { Pencil, Trash2, Maximize2, GripVertical } from 'lucide-vue-next'
import { useAppStore } from '@/store/app'
import { api } from '@/api'
import type { Widget } from '@/types'
import HotlistWidget from './widgets/HotlistWidget.vue'
import WeatherWidget from './widgets/WeatherWidget.vue'
import ClockWidget from './widgets/ClockWidget.vue'
import CalendarWidget from './widgets/CalendarWidget.vue'
import CountdownWidget from './widgets/CountdownWidget.vue'
import CustomIframeWidget from './widgets/CustomIframeWidget.vue'
import { GRID_COLS, buildLayout, moveAndCompact, totalRows, type GridItem } from '@/utils/gridLayout'

const app = useAppStore()

const emit = defineEmits<{
  (e: 'edit', w: Widget): void
}>()

const ROW_HEIGHT = 110
const GAP = 10

const enabledWidgets = computed(() => app.widgets.filter((w) => w.enabled === 1))

// 布局状态：以 GridItem 形式维护
const layout = ref<GridItem[]>([])

// 从 store 同步到 layout（切换分组、增删改后）
watch(
  () => enabledWidgets.value.map((w) => `${w.id}:${w.x}:${w.y}:${w.cols}:${w.rows}`).join(','),
  () => {
    layout.value = buildLayout(enabledWidgets.value)
  },
  { immediate: true },
)

// layout 项与 widget 配对，避免模板里反复 find
const pairs = computed(() =>
  layout.value
    .map((item) => ({ item, widget: enabledWidgets.value.find((w) => w.id === item.id) }))
    .filter((p): p is { item: GridItem; widget: Widget } => !!p.widget),
)

// 渲染样式
function styleFor(item: GridItem) {
  const cellW = `((100% - ${(GRID_COLS - 1) * GAP}px) / ${GRID_COLS})`
  const hGapX = item.x * GAP
  const wGap = (item.cols - 1) * GAP
  const hGapY = item.y * (ROW_HEIGHT + GAP)
  const hGap = (item.rows - 1) * GAP + item.rows * ROW_HEIGHT
  return {
    left: `calc(${item.x} * ${cellW} + ${hGapX}px)`,
    top: `${hGapY}px`,
    width: `calc(${item.cols} * ${cellW} + ${wGap}px)`,
    height: `${hGap}px`,
  }
}

const gridHeight = computed(() => {
  const rows = totalRows(layout.value)
  return rows > 0 ? rows * (ROW_HEIGHT + GAP) - GAP : 0
})

/* ============ 拖拽 ============ */
const dragging = ref<{ id: GridItem['id']; startX: number; startY: number; origX: number; origY: number } | null>(null)
const dragMoved = ref(false)
const containerEl = ref<HTMLElement | null>(null)

function onPointerDown(e: PointerEvent, item: GridItem) {
  if (e.button !== 0) return
  if ((e.target as HTMLElement).closest('.w-act, .no-drag')) return
  dragging.value = { id: item.id, startX: e.clientX, startY: e.clientY, origX: item.x, origY: item.y }
  dragMoved.value = false
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  e.preventDefault()
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value || !containerEl.value) return
  const dx = e.clientX - dragging.value.startX
  const dy = e.clientY - dragging.value.startY
  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved.value = true

  const rect = containerEl.value.getBoundingClientRect()
  const cellW = (rect.width - (GRID_COLS - 1) * GAP) / GRID_COLS
  const stepX = Math.round(dx / (cellW + GAP))
  const stepY = Math.round(dy / (ROW_HEIGHT + GAP))
  const target = layout.value.find((i) => i.id === dragging.value!.id)
  if (!target) return
  const newX = Math.max(0, Math.min(dragging.value.origX + stepX, GRID_COLS - target.cols))
  const newY = Math.max(0, dragging.value.origY + stepY)
  if (target.x === newX && target.y === newY) return
  layout.value = moveAndCompact(layout.value, dragging.value.id, newX, newY)
}

let persistTimer: ReturnType<typeof setTimeout> | null = null
function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(persistLayout, 600)
}

async function persistLayout() {
  if (!dragMoved.value) return
  try {
    await api.layoutWidgets(
      layout.value.map((i, idx) => ({
        id: i.id as number,
        x: i.x,
        y: i.y,
        cols: i.cols,
        rows: i.rows,
        sortOrder: idx,
      })),
    )
    // 回写 store，避免 watch 再次触发重排
    for (const i of layout.value) {
      const w = app.widgets.find((x) => x.id === i.id)
      if (w) { w.x = i.x; w.y = i.y; w.cols = i.cols; w.rows = i.rows }
    }
  } catch (e) {
    console.warn('persist layout failed', e)
  }
}

function onPointerUp() {
  if (dragging.value) {
    if (dragMoved.value) schedulePersist()
    dragging.value = null
  }
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})

/* ============ 增删改 ============ */
function editWidget(w: Widget) { emit('edit', w) }

async function deleteWidget(w: Widget) {
  if (!confirm(`删除组件「${w.name || w.type}」？`)) return
  await api.deleteWidget(w.id)
  app.widgets = app.widgets.filter((x) => x.id !== w.id)
}

function componentFor(w: Widget) {
  switch (w.type) {
    case 'hotlist': return HotlistWidget
    case 'weather': return WeatherWidget
    case 'clock': return ClockWidget
    case 'calendar': return CalendarWidget
    case 'countdown': return CountdownWidget
    case 'custom': return CustomIframeWidget
    default: return null
  }
}

/* ============ 内嵌组件（iframe）的"打开"功能 ============ */
const iframeRefs = ref<Record<number, { openPopup?: () => void }>>({})
function setIframeRef(id: number, el: unknown) {
  if (el) iframeRefs.value[id] = el as { openPopup?: () => void }
}
function openIframe(w: Widget) { iframeRefs.value[w.id]?.openPopup?.() }
function iframeOpenable(w: Widget): boolean {
  if (w.type !== 'custom') return false
  try { return JSON.parse(w.config || '{}').clickBehavior === 'popup' } catch { return false }
}
</script>

<template>
  <div class="wg">
    <div class="grid" ref="containerEl" :style="{ height: gridHeight + 'px' }">
      <div
        v-for="{ item, widget } in pairs"
        :key="item.id"
        class="widget card"
        :class="{ dragging: dragging?.id === item.id }"
        :style="styleFor(item)"
      >
        <div class="drag-handle" title="拖动到任意位置" @pointerdown="onPointerDown($event, item)">
          <GripVertical :size="12" />
        </div>
        <div class="widget-actions">
          <button v-if="iframeOpenable(widget)" class="w-act no-drag" @click="openIframe(widget)" title="打开">
            <Maximize2 :size="12" />
          </button>
          <button class="w-act no-drag" @click="editWidget(widget)" title="编辑">
            <Pencil :size="12" />
          </button>
          <button class="w-act no-drag danger" @click="deleteWidget(widget)" title="删除">
            <Trash2 :size="12" />
          </button>
        </div>
        <component
          :is="componentFor(widget)"
          v-if="componentFor(widget)"
          :ref="(el) => setIframeRef(item.id as number, el)"
          :widget="widget"
        />
        <div v-else class="unknown">未知组件类型</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wg { width: 100%; }
.grid {
  position: relative;
  width: 100%;
  min-height: 120px;
}
.widget {
  position: absolute;
  border-radius: 14px;
  overflow: hidden;
  cursor: default;
  user-select: none;
  transition: left 0.22s cubic-bezier(0.2, 0.8, 0.2, 1),
              top 0.22s cubic-bezier(0.2, 0.8, 0.2, 1),
              width 0.22s cubic-bezier(0.2, 0.8, 0.2, 1),
              height 0.22s cubic-bezier(0.2, 0.8, 0.2, 1),
              box-shadow 0.15s, opacity 0.15s;
}
.widget.dragging {
  cursor: grabbing;
  box-shadow: 0 8px 24px rgba(0,0,0,0.25);
  z-index: 10;
  opacity: 0.92;
  /* 拖拽中的组件不动画位置，紧跟指针 */
  transition: box-shadow 0.15s, opacity 0.15s;
}
.drag-handle {
  position: absolute;
  top: 6px; left: 6px;
  width: 20px; height: 20px;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-secondary);
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 5;
}
.widget:hover .drag-handle { opacity: 0.6; }
.drag-handle:hover { opacity: 1 !important; }
.widget-actions {
  position: absolute;
  top: 6px; right: 6px;
  display: flex; gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 5;
}
.widget:hover .widget-actions { opacity: 1; }
.w-act {
  width: 22px; height: 22px; border-radius: 50%;
  border: none; background: var(--card-bg);
  color: var(--text-secondary); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.w-act:hover { background: var(--input-bg); }
.w-act.danger:hover { background: rgba(255,80,80,0.2); color: #ff6b6b; }

.unknown { padding: 12px; color: var(--text-secondary); font-size: 12px; }
</style>
