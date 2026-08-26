<script setup lang="ts">
import { computed, ref } from 'vue'
import { Folder as FolderIcon } from 'lucide-vue-next'
import type { Bookmark } from '@/types'
import { api } from '@/api'
import { useAppStore } from '@/store/app'
import BookmarkItem from './BookmarkItem.vue'
import BookmarkModal from './BookmarkModal.vue'
import FolderModal from './FolderModal.vue'
import ContextMenu from './ContextMenu.vue'

const app = useAppStore()

/** 顶层书签（parentId 为空） */
const rootBookmarks = computed(() =>
  app.bookmarks
    .filter((b) => b.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder),
)

/** 文件夹的子书签（用于在文件夹图标上显示内部书签预览） */
function folderChildren(bm: Bookmark) {
  if (bm.type !== 1) return undefined
  return app.bookmarks
    .filter((b) => b.parentId === bm.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

const emit = defineEmits<{
  (e: 'add'): void
}>()

/* ============ 拖拽与聚合 ============ */
const dragId = ref<number | null>(null)
const hoverId = ref<number | null>(null)
const hoverMode = ref<'merge' | 'before' | 'after' | null>(null)
const MERGE_RATIO = 0.45 // 落点距中心 < 短边*0.45 视为聚合

function onDragStart(e: DragEvent, bm: Bookmark) {
  dragId.value = bm.id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(bm.id))
  }
}

function onDragEnd() {
  dragId.value = null
  hoverId.value = null
  hoverMode.value = null
}

function onDragOver(e: DragEvent, bm: Bookmark) {
  if (dragId.value === null || dragId.value === bm.id) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'

  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const dx = e.clientX - cx
  const dy = e.clientY - cy
  const shortSide = Math.min(rect.width, rect.height)
  const dist = Math.hypot(dx, dy)

  hoverId.value = bm.id

  // 已存在的文件夹：落点接近中心则"加入文件夹"，否则按 X 位置插入
  if (bm.type === 1) {
    if (dist < shortSide * MERGE_RATIO) {
      hoverMode.value = 'merge'
    } else {
      hoverMode.value = dx < 0 ? 'before' : 'after'
    }
    return
  }

  // 普通书签：落点接近中心 = 聚合为文件夹；左半 = before；右半 = after
  if (dist < shortSide * MERGE_RATIO) {
    hoverMode.value = 'merge'
  } else {
    hoverMode.value = dx < 0 ? 'before' : 'after'
  }
}

function onDragLeave(_e: DragEvent, bm: Bookmark) {
  // 仅当离开当前 hover 目标时清除
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

  try {
    if (mode === 'merge') {
      await mergeIntoFolder(src, target)
    } else {
      await reorder(src, target, mode)
    }
  } catch (err) {
    console.error('移动失败', err)
  }
}

/** 聚合为文件夹：若 target 已是文件夹则加入，否则新建文件夹 */
async function mergeIntoFolder(src: Bookmark, target: Bookmark) {
  let folderId: number
  if (target.type === 1) {
    folderId = target.id
  } else {
    // 创建新文件夹，名称取 target.name
    const folder = await api.saveBookmark({
      groupId: app.currentGroupId,
      parentId: null,
      type: 1,
      name: target.name + ' 文件夹',
      iconType: 'default',
      sortOrder: target.sortOrder,
    })
    app.bookmarks.push(folder)
    folderId = folder.id
    // 将 target 也归入文件夹
    await api.moveBookmark({
      id: target.id,
      parentId: folderId,
      sortOrder: 0,
    })
    target.parentId = folderId
    target.sortOrder = 0
  }
  // 将 src 归入文件夹末尾
  const siblings = app.bookmarks.filter(
    (b) => b.parentId === folderId && b.id !== src.id,
  )
  const nextOrder = siblings.length
    ? Math.max(...siblings.map((b) => b.sortOrder)) + 1
    : 0
  await api.moveBookmark({
    id: src.id,
    parentId: folderId,
    sortOrder: nextOrder,
  })
  src.parentId = folderId
  src.sortOrder = nextOrder
}

/** 排序：将 src 插入 target 之前/之后（同级） */
async function reorder(src: Bookmark, target: Bookmark, mode: 'before' | 'after') {
  const siblings = app.bookmarks
    .filter((b) => b.parentId === target.parentId && b.id !== src.id)
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
}

/* ============ 右键菜单 ============ */
const menu = ref<{ x: number; y: number; bm: Bookmark } | null>(null)
function openMenu(x: number, y: number, bm: Bookmark) {
  menu.value = { x, y, bm }
}
function closeMenu() {
  menu.value = null
}

/* ============ 编辑/打开文件夹 ============ */
const editTarget = ref<Bookmark | null>(null)
const folderTarget = ref<Bookmark | null>(null)
const addOpen = ref(false)

function onAdd() {
  editTarget.value = null
  addOpen.value = true
}

function onEdit(bm: Bookmark) {
  editTarget.value = bm
  addOpen.value = true
  closeMenu()
}

function onOpenFolder(bm: Bookmark) {
  folderTarget.value = bm
  closeMenu()
}

async function onDelete(bm: Bookmark) {
  if (!confirm(`确认删除「${bm.name}」？`)) return
  await api.deleteBookmark(bm.id)
  app.bookmarks = app.bookmarks.filter((b) => b.id !== bm.id)
  if (bm.type === 1) {
    // 级联删子项（后端已级联，前端同步）
    app.bookmarks = app.bookmarks.filter((b) => b.parentId !== bm.id)
  }
  closeMenu()
}

function onMenuAction(action: string, bm: Bookmark) {
  switch (action) {
    case 'edit':
      onEdit(bm)
      break
    case 'open':
      if (bm.type === 1) onOpenFolder(bm)
      else if (bm.url) window.open(bm.url, app.bookmarkOpenTarget === 'self' ? '_self' : '_blank')
      break
    case 'delete':
      onDelete(bm)
      break
    case 'split':
      onSplitOut(bm)
      break
  }
}

/** 将书签从文件夹中拆分出来，落到顶层末尾 */
async function onSplitOut(bm: Bookmark) {
  if (bm.parentId === null) {
    closeMenu()
    return
  }
  try {
    const rootSiblings = app.bookmarks.filter(
      (b) => b.parentId === null && b.id !== bm.id,
    )
    const nextOrder = rootSiblings.length
      ? Math.max(...rootSiblings.map((b) => b.sortOrder)) + 1
      : 0
    await api.moveBookmark({
      id: bm.id,
      groupId: bm.groupId,
      parentId: null,
      sortOrder: nextOrder,
    })
    bm.parentId = null
    bm.sortOrder = nextOrder
  } catch (err) {
    console.error('移出文件夹失败', err)
  }
  closeMenu()
}

/* modal 保存后刷新数据 */
async function onSaved() {
  addOpen.value = false
  editTarget.value = null
  await app.loadGroupData()
}

defineExpose({ addBookmark: onAdd })
</script>

<template>
  <div class="bm-grid">
    <div class="grid">
      <BookmarkItem
        v-for="bm in rootBookmarks"
        :key="bm.id"
        :bm="bm"
        :hover-mode="hoverId === bm.id ? hoverMode : null"
        :dragging="dragId === bm.id"
        :children="folderChildren(bm)"
        @open="onOpenFolder(bm)"
        @edit="onEdit(bm)"
        @menu="(x, y) => openMenu(x, y, bm)"
        @dragstart="(e: DragEvent) => onDragStart(e, bm)"
        @dragend="onDragEnd"
        @dragover="(e: DragEvent) => onDragOver(e, bm)"
        @dragleave="(e: DragEvent) => onDragLeave(e, bm)"
        @drop="(e: DragEvent) => onDrop(e, bm)"
      />
    </div>

    <!-- 空状态 -->
    <div v-if="!rootBookmarks.length" class="empty-hint">
      <FolderIcon :size="42" />
      <p>当前分组还没有书签</p>
      <p class="hint-sub">在空白处右键即可新建书签</p>
    </div>

    <!-- 编辑/新增书签弹窗 -->
    <BookmarkModal
      v-if="addOpen"
      :bm="editTarget"
      :group-id="app.currentGroupId!"
      @close="addOpen = false"
      @saved="onSaved"
    />

    <!-- 文件夹内容弹窗 -->
    <FolderModal
      v-if="folderTarget"
      :folder="folderTarget"
      @close="folderTarget = null"
      @edit="onEdit"
      @menu="openMenu"
      @changed="app.loadGroupData()"
    />

    <!-- 右键菜单 -->
    <ContextMenu
      v-if="menu"
      :x="menu.x"
      :y="menu.y"
      :bm="menu.bm"
      @action="(a: string) => onMenuAction(a, menu!.bm)"
      @close="closeMenu"
    />
  </div>
</template>

<style scoped>
.bm-grid {
  width: 100%;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.hint-sub { font-size: 12px; color: var(--text-secondary); opacity: 0.7; }
.empty-hint {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 60px 20px; color: var(--text-secondary);
}
.empty-hint p { margin: 0; font-size: 14px; }
</style>
