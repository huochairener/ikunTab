<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { Pencil, ExternalLink, Trash2, ArrowUp } from 'lucide-vue-next'
import type { Bookmark } from '@/types'

const props = defineProps<{
  x: number
  y: number
  bm: Bookmark
}>()
const emit = defineEmits<{
  (e: 'action', action: string): void
  (e: 'close'): void
}>()

function onDocClick() {
  emit('close')
}
onMounted(() => {
  setTimeout(() => document.addEventListener('click', onDocClick), 0)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
})

function act(a: string) {
  emit('action', a)
  emit('close')
}

// 防止超出右边界
const left = Math.min(props.x, window.innerWidth - 170)
const top = Math.min(props.y, window.innerHeight - 180)
</script>

<template>
  <Teleport to="body">
  <div class="ctx glass" :style="{ left: left + 'px', top: top + 'px' }">
    <button v-if="bm.type === 0" class="item" @click="act('open')">
      <ExternalLink :size="14" /> 打开
    </button>
    <button v-if="bm.parentId !== null" class="item" @click="act('split')">
      <ArrowUp :size="14" /> 移出文件夹
    </button>
    <button class="item" @click="act('edit')">
      <Pencil :size="14" /> 编辑
    </button>
    <button class="item danger" @click="act('delete')">
      <Trash2 :size="14" /> 删除
    </button>
  </div>
  </Teleport>
</template>

<style scoped>
.ctx {
  position: fixed; z-index: 200;
  min-width: 140px; padding: 4px;
  border-radius: 10px;
  display: flex; flex-direction: column; gap: 2px;
}
.item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border: none; background: transparent;
  color: var(--text-primary); cursor: pointer; font-size: 13px;
  border-radius: 7px; text-align: left;
}
.item:hover { background: var(--input-bg); }
.item.danger:hover { background: rgba(255, 80, 80, 0.15); color: #ff6b6b; }
</style>
