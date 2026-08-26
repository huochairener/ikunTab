<script setup lang="ts">
import { computed, ref } from 'vue'
import { X, Plus, ArrowLeft } from 'lucide-vue-next'
import type { Bookmark } from '@/types'
import { useAppStore } from '@/store/app'
import { api } from '@/api'
import BookmarkItem from './BookmarkItem.vue'
import BookmarkModal from './BookmarkModal.vue'

const props = defineProps<{
  folder: Bookmark
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'edit', bm: Bookmark): void
  (e: 'menu', x: number, y: number, bm: Bookmark): void
  (e: 'changed'): void
}>()

const app = useAppStore()

const children = computed(() =>
  app.bookmarks
    .filter((b) => b.parentId === props.folder.id)
    .sort((a, b) => a.sortOrder - b.sortOrder),
)

/** 子文件夹的孙书签（用于文件夹内显示子文件夹图标预览） */
function folderChildren(bm: Bookmark) {
  if (bm.type !== 1) return undefined
  return app.bookmarks
    .filter((b) => b.parentId === bm.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

const addOpen = ref(false)

/* 拖拽进文件夹内 */
const dragId = ref<number | null>(null)
const hoverId = ref<number | null>(null)
const hoverMode = ref<'merge' | 'before' | 'after' | null>(null)

function onDragStart(e: DragEvent, bm: Bookmark) {
  dragId.value = bm.id
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onDragEnd() {
  dragId.value = null
  hoverId.value = null
  hoverMode.value = null
  dropOutActive.value = false
}
function onDragOver(e: DragEvent, bm: Bookmark) {
  if (dragId.value === null || dragId.value === bm.id) return
  e.preventDefault()
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const dx = e.clientX - cx
  hoverId.value = bm.id
  // 文件夹内部仅支持前后插入排序，不再合并为子文件夹
  hoverMode.value = dx < 0 ? 'before' : 'after'
}
function onDragLeave(bm: Bookmark) {
  if (hoverId.value === bm.id) {
    hoverId.value = null
    hoverMode.value = null
  }
}
async function onDrop(e: DragEvent, target: Bookmark) {
  e.preventDefault()
  const srcId = dragId.value
  const mode = hoverMode.value
  onDragEnd()
  if (srcId === null || srcId === target.id || !mode) return
  const src = app.bookmarks.find((b) => b.id === srcId)
  if (!src) return
  // 排序到 target 同级前后
  const siblings = app.bookmarks
    .filter((b) => b.parentId === target.parentId && b.id !== srcId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  const idx = siblings.findIndex((b) => b.id === target.id)
  const insertAt = mode === 'before' ? idx : idx + 1
  siblings.splice(insertAt, 0, src)
  siblings.forEach((b, i) => (b.sortOrder = i))
  src.parentId = target.parentId
  // 批量提交所有同级书签的新排序
  await api.sortBookmarks(
    siblings.map((b) => ({
      id: b.id,
      parentId: b.parentId,
      sortOrder: b.sortOrder,
    })),
  )
  emit('changed')
}

function onAdd() {
  addOpen.value = true
}
async function onSaved() {
  addOpen.value = false
  emit('changed')
}

function onMenu(x: number, y: number, bm: Bookmark) {
  emit('menu', x, y, bm)
}

/* ============ 拖出文件夹到顶层 ============ */
const dropOutActive = ref(false)

function onDropZoneOver(e: DragEvent) {
  if (dragId.value === null) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dropOutActive.value = true
}
function onDropZoneLeave() {
  dropOutActive.value = false
}
/** 将当前拖拽的书签移出文件夹，落到顶层末尾 */
async function splitOutToRoot(srcId: number) {
  const src = app.bookmarks.find((b) => b.id === srcId)
  if (!src || src.parentId === null) return
  const rootSiblings = app.bookmarks.filter(
    (b) => b.parentId === null && b.id !== srcId,
  )
  const nextOrder = rootSiblings.length
    ? Math.max(...rootSiblings.map((b) => b.sortOrder)) + 1
    : 0
  await api.moveBookmark({
    id: srcId,
    groupId: src.groupId,
    parentId: null,
    sortOrder: nextOrder,
  })
  src.parentId = null
  src.sortOrder = nextOrder
}
async function onDropOut(e: DragEvent) {
  e.preventDefault()
  const srcId = dragId.value
  dropOutActive.value = false
  onDragEnd()
  if (srcId === null) return
  try {
    await splitOutToRoot(srcId)
    emit('changed')
  } catch (err) {
    console.error('移出文件夹失败', err)
  }
}
</script>

<template>
  <Teleport to="body">
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal glass">
      <header>
        <button class="back" @click="emit('close')">
          <ArrowLeft :size="18" />
        </button>
        <h3>{{ folder.name }}</h3>
        <button class="x" @click="emit('close')"><X :size="18" /></button>
      </header>

      <div class="folder-body">
        <!-- 拖出文件夹的 drop zone：仅在拖拽时显示，拖到此处可移出文件夹 -->
        <div
          v-show="dragId !== null"
          class="drop-out-zone"
          :class="{ active: dropOutActive }"
          @dragover="onDropZoneOver"
          @dragleave="onDropZoneLeave"
          @drop="onDropOut"
        >
          <span class="arrow">↑</span>
          <span class="text">释放鼠标可移出文件夹</span>
        </div>

        <div v-if="children.length" class="grid">
          <BookmarkItem
            v-for="bm in children"
            :key="bm.id"
            :bm="bm"
            :hover-mode="hoverId === bm.id ? hoverMode : null"
            :dragging="dragId === bm.id"
            :children="folderChildren(bm)"
            @edit="emit('edit', bm)"
            @menu="(x, y) => onMenu(x, y, bm)"
            @dragstart="(e: DragEvent) => onDragStart(e, bm)"
            @dragend="onDragEnd"
            @dragover="(e: DragEvent) => onDragOver(e, bm)"
            @dragleave="onDragLeave(bm)"
            @drop="(e: DragEvent) => onDrop(e, bm)"
          />
          <button class="add-card" @click="onAdd">
            <Plus :size="22" />
            <span>添加书签</span>
          </button>
        </div>
        <div v-else class="empty">
          <p>文件夹是空的</p>
          <button class="btn btn-primary" @click="onAdd">
            <Plus :size="16" /> 添加书签
          </button>
        </div>
      </div>

      <BookmarkModal
        v-if="addOpen"
        :bm="null"
        :group-id="app.currentGroupId!"
        :parent-id="folder.id"
        @close="addOpen = false"
        @saved="onSaved"
      />
    </div>
  </div>
  </Teleport>
</template>

<style scoped>
.modal-mask {
  position: fixed; inset: 0; z-index: 70;
  background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(2px);
}
.modal {
  width: min(860px, 94vw); max-height: 80vh;
  border-radius: 18px; padding: 20px;
  display: flex; flex-direction: column;
}
header {
  display: flex; align-items: center; gap: 12px; margin-bottom: 18px;
}
.back, .x {
  border: none; background: transparent; color: var(--text-secondary);
  cursor: pointer; padding: 4px; border-radius: 8px;
}
.back:hover, .x:hover { background: var(--input-bg); }
header h3 { flex: 1; font-size: 17px; margin: 0; font-weight: 600; }

.folder-body { flex: 1; overflow-y: auto; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.add-card {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; min-height: 78px;
  border: 1.5px dashed var(--glass-border); border-radius: 14px;
  background: transparent; color: var(--text-secondary);
  cursor: pointer; transition: all 0.15s;
}
.add-card:hover { border-color: var(--accent); color: var(--accent); }
.add-card span { font-size: 12px; }
.empty {
  display: flex; flex-direction: column; align-items: center; gap: 14px;
  padding: 50px 20px; color: var(--text-secondary);
}
.empty p { margin: 0; font-size: 14px; }

/* 拖出文件夹的 drop zone */
.drop-out-zone {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 44px;
  margin-bottom: 12px;
  padding: 8px 12px;
  border: 1.5px dashed var(--glass-border);
  border-radius: 12px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  transition: all 0.15s;
  user-select: none;
}
.drop-out-zone .arrow {
  font-size: 16px; font-weight: 600; line-height: 1;
}
.drop-out-zone.active {
  border-style: solid;
  border-color: var(--accent);
  background: rgba(99, 102, 241, 0.08);
  color: var(--accent);
  transform: scale(1.01);
}
</style>
