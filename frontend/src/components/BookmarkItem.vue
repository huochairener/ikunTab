<script setup lang="ts">
import { computed, ref } from 'vue'
import { Folder, MoreVertical } from 'lucide-vue-next'
import type { Bookmark } from '@/types'
import { iconUrl, letter, domainOf } from '@/utils/bookmark'
import { useAppStore } from '@/store/app'

const props = defineProps<{
  bm: Bookmark
  hoverMode?: 'merge' | 'before' | 'after' | null
  dragging?: boolean
  children?: Bookmark[]
}>()
const emit = defineEmits<{
  (e: 'open'): void
  (e: 'edit'): void
  (e: 'menu', x: number, y: number): void
  (e: 'dragstart', ev: DragEvent): void
  (e: 'dragend', ev: DragEvent): void
  (e: 'dragover', ev: DragEvent): void
  (e: 'dragleave', ev: DragEvent): void
  (e: 'drop', ev: DragEvent): void
}>()

const imgError = ref(false)
const app = useAppStore()
const src = computed(() => (props.bm.iconType === 'default' ? null : iconUrl(props.bm)))
const showLetter = computed(() => !src.value || imgError.value)
const domain = computed(() => domainOf(props.bm.url))

/* 文件夹：有子书签就显示堆叠图标；子书签 > 7 时才在末尾加"名称占位"虚拟图标，并去掉右侧文件夹名称 */
const FOLDER_NAME_CHIP_THRESHOLD = 7
const MAX_VISIBLE_ICONS = 3
const childErr = ref<Record<number, boolean>>({})
const hasChildren = computed(
  () => props.bm.type === 1 && !!props.children && props.children.length > 0,
)
/* 子书签过多时启用末尾数量占位（右侧改显示文件夹名称） */
const useNameChip = computed(
  () => hasChildren.value && props.children!.length > FOLDER_NAME_CHIP_THRESHOLD,
)
const visibleChildIcons = computed(() => {
  if (!hasChildren.value) return []
  return props.children!.slice(0, MAX_VISIBLE_ICONS).map((c) => ({
    src: c.iconType === 'default' ? null : iconUrl(c),
    ch: letter(c.name),
  }))
})
/* 是否还有未展示的子书签（决定前面的实际书签图标是否应用渐隐效果） */
const hasMore = computed(
  () => !!props.children && props.children.length > visibleChildIcons.value.length,
)
const childCount = computed(() => props.children?.length ?? 0)

function onClick() {
  if (props.bm.type === 1) emit('open')
  else if (props.bm.url) window.open(props.bm.url, app.bookmarkOpenTarget === 'self' ? '_self' : '_blank')
}
</script>

<template>
  <div
    class="bm"
    :class="[hoverMode ? `hv-${hoverMode}` : '', dragging ? 'dragging' : '']"
    draggable="true"
    @contextmenu.prevent="emit('menu', $event.clientX, $event.clientY)"
    @click="onClick"
    @dragstart="emit('dragstart', $event)"
    @dragend="emit('dragend', $event)"
    @dragover="emit('dragover', $event)"
    @dragleave="emit('dragleave', $event)"
    @drop="emit('drop', $event)"
  >
    <div class="bm-inner">
      <div class="icon-wrap" :class="{ 'is-folder': hasChildren }">
        <template v-if="hasChildren">
          <div class="folder-stack">
            <div
              v-for="(ci, i) in visibleChildIcons"
              :key="i"
              class="fs-item"
              :class="{ faded: hasMore && i === visibleChildIcons.length - 1 }"
            >
              <img v-if="ci.src && !childErr[i]" :src="ci.src" alt="" @error="childErr[i] = true" />
              <span v-else class="fs-letter">{{ ci.ch }}</span>
            </div>
            <div v-if="useNameChip" class="fs-name">
              <span class="fs-name-text">{{ childCount }}</span>
            </div>
          </div>
        </template>
        <template v-else>
          <img v-if="src && !imgError" :src="src" alt="" @error="imgError = true" />
          <span v-else class="letter">{{ letter(bm.name) }}</span>
          <span v-if="bm.type === 1" class="folder-badge"><Folder :size="11" /></span>
        </template>
      </div>
      <div class="meta">
        <template v-if="useNameChip">
          <span class="url">{{ bm.name }}</span>
        </template>
        <template v-else>
          <span class="name">{{ bm.name }}</span>
          <span class="url">{{ bm.type === 1 ? '文件夹' : domain || '书签' }}</span>
        </template>
      </div>
      <button class="more" @click.stop="emit('menu', $event.clientX, $event.clientY)">
        <MoreVertical :size="14" />
      </button>
    </div>
    <transition name="fade">
      <div v-if="hoverMode === 'merge'" class="merge-tip">合并为文件夹</div>
    </transition>
  </div>
</template>

<style scoped>
.bm {
  position: relative;
  border-radius: 14px;
  border: 2px dashed transparent;
  transition: border-color 0.15s, transform 0.15s;
  cursor: grab;
}
.bm:active { cursor: grabbing; }
.bm-inner {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: 12px;
  background: var(--card-bg); border: 1px solid var(--glass-border);
  backdrop-filter: blur(12px); transition: transform 0.15s, box-shadow 0.15s;
}
.bm-inner:hover { transform: translateY(-2px); box-shadow: var(--glass-shadow); }
.icon-wrap {
  position: relative; width: 34px; height: 34px; border-radius: 9px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  background: var(--input-bg); overflow: visible;
}
.icon-wrap img { width: 28px; height: 28px; border-radius: 6px; object-fit: contain; }
.letter { font-weight: 600; font-size: 16px; color: var(--accent); }
.folder-badge {
  position: absolute; bottom: -3px; right: -3px;
  background: var(--accent); color: #fff; border-radius: 50%;
  width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;
}

/* 文件夹（堆叠模式）：横向堆叠图标 + 末尾名称占位 */
.icon-wrap.is-folder {
  width: auto;
  height: 34px;
  background: transparent;
  border-radius: 0;
  padding: 0 2px;
}
.folder-stack {
  display: flex; align-items: center;
  height: 28px;
}
.folder-stack > * {
  width: 28px; height: 28px;
  border-radius: 7px;
  background: var(--input-bg);
  border: 1px solid var(--glass-border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; position: relative;
}
/* 后一个压住前一个的 1/2 */
.folder-stack > * + * { margin-left: -14px; }
/* 越靠后越在上层 */
.folder-stack > *:nth-child(1) { z-index: 1; }
.folder-stack > *:nth-child(2) { z-index: 2; }
.folder-stack > *:nth-child(3) { z-index: 3; }
.folder-stack > *:nth-child(4) { z-index: 4; }
.folder-stack > *:nth-child(5) { z-index: 5; }

.fs-item img {
  width: 22px; height: 22px;
  border-radius: 4px; object-fit: contain;
}
.fs-letter { font-size: 11px; font-weight: 600; color: var(--accent); }

/* 末尾名称占位：与图标同尺寸（正方形 28×28），文字换行显示 */
.fs-name {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  padding: 2px;
  overflow: hidden;
  line-height: 1.05;
}
.fs-name-text {
  font-size: 9px; font-weight: 600;
  word-break: break-all;
  white-space: normal;
  letter-spacing: -0.3px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-align: center;
}
/* 还有未展示的子书签时，最后一个实际书签图标从右到左渐隐，提示"未完全展示"；
   末尾的数量占位（逻辑书签）不应用渐隐 */
.fs-item.faded {
  -webkit-mask-image: linear-gradient(to left, #000 55%, transparent 100%);
  mask-image: linear-gradient(to left, #000 55%, transparent 100%);
}
.meta { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.name { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.url { font-size: 11px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.more {
  border: none; background: transparent; color: var(--text-secondary);
  cursor: pointer; opacity: 0; transition: opacity 0.15s; padding: 4px; border-radius: 6px;
}
.bm:hover .more { opacity: 1; }
.more:hover { background: var(--input-bg); }
.hv-merge { border-color: var(--accent); }
.hv-before { border-left-color: var(--accent); border-left-style: solid; }
.hv-after { border-right-color: var(--accent); border-right-style: solid; }
.dragging { opacity: 0.4; }
.merge-tip {
  position: absolute; top: -26px; left: 50%; transform: translateX(-50%);
  background: var(--accent); color: #fff; font-size: 11px; padding: 3px 8px;
  border-radius: 999px; white-space: nowrap; pointer-events: none;
}
</style>
