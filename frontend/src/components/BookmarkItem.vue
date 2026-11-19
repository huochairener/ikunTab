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

/* 文件夹：有子书签就显示渐隐堆叠图标，数量单独放在卡片最右侧（小号数字） */
const MAX_VISIBLE_ICONS = 3
const childErr = ref<Record<number, boolean>>({})
const hasChildren = computed(
  () => props.bm.type === 1 && !!props.children && props.children.length > 0,
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
          </div>
        </template>
        <template v-else>
          <img v-if="src && !imgError" :src="src" alt="" @error="imgError = true" />
          <span v-else class="letter">{{ letter(bm.name) }}</span>
          <span v-if="bm.type === 1" class="folder-badge"><Folder :size="11" /></span>
        </template>
      </div>
      <div class="meta">
        <span class="name">{{ bm.name }}</span>
        <span class="url">{{ bm.type === 1 ? '文件夹' : domain || '书签' }}</span>
      </div>
      <button class="more" @click.stop="emit('menu', $event.clientX, $event.clientY)">
        <MoreVertical :size="14" />
      </button>
      <!-- 文件夹内书签数量：卡片最右侧，比图标更小的角标 -->
      <span v-if="hasChildren" class="bm-count">{{ childCount }}</span>
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
@media (hover: hover) {
  .bm-inner:hover { transform: translateY(-2px); box-shadow: var(--glass-shadow); }
}
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

/* 文件夹（堆叠模式）：横向堆叠图标，末尾渐隐提示还有更多 */
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

/* 还有未展示的子书签时，最后一个书签图标从右到左渐隐，提示"未完全展示" */
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
/* 文件夹内书签数量：位于卡片最右侧，尺寸明显小于图标（18px vs 28/34px） */
.bm-count {
  flex-shrink: 0;
  min-width: 18px; height: 18px;
  padding: 0 5px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 999px;
  background: var(--accent);
  border: 1px solid var(--accent);
  color: #fff;
  font-size: 10px; font-weight: 600; line-height: 1;
  font-variant-numeric: tabular-nums;
}
/* 触摸设备：补上只有 hover 才可见的操作入口，并避免横滑切组时误选文字 */
@media (hover: none) {
  .more { opacity: 0.55; }
  .bm { -webkit-user-select: none; user-select: none; }
}
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
