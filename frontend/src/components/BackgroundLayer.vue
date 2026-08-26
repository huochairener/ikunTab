<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAppStore } from '@/store/app'

const app = useAppStore()

// 缓存随机图的时间戳，仅在背景类型/地址真正变化时才重新生成，
// 避免切换搜索引擎等操作整体替换 settings 引用时导致背景图刷新。
const randomTs = ref(Date.now())
let lastRandomKey = ''

watch(
  () => {
    const s = app.settings
    return s ? `${s.backgroundType}::${s.backgroundValue ?? ''}` : ''
  },
  (key) => {
    if (key.startsWith('random::') && key !== lastRandomKey) {
      randomTs.value = Date.now()
    }
    lastRandomKey = key
  },
  { immediate: true },
)

const bgStyle = computed(() => {
  const s = app.settings
  if (!s) return {}
  if (s.backgroundType === 'random' && s.backgroundValue) {
    const sep = s.backgroundValue.includes('?') ? '&' : '?'
    return { backgroundImage: `url("${s.backgroundValue}${sep}t=${randomTs.value}")` }
  }
  if (s.backgroundType === 'upload' && s.backgroundValue) {
    return { backgroundImage: `url("${s.backgroundValue}")` }
  }
  if (s.backgroundType === 'bing') {
    return { backgroundImage: `url("https://api.dujin.org/bing/1920.php?t=${new Date().toDateString()}")` }
  }
  return {}
})

const animated = computed(() => app.settings?.backgroundAnimation === 1)
</script>

<template>
  <div class="bg-layer" :class="{ 'is-animated': animated }" :style="bgStyle">
    <div class="bg-overlay"></div>
  </div>
</template>

<style scoped>
.bg-layer {
  position: fixed; inset: 0;
  background-size: cover;
  background-position: center;
  z-index: -2;
  transition: background-image 0.6s ease;
}
/*
  开启动效：将背景图放大到 125%，仅在元素内部用 background-position 平移，
  不使用 transform（transform 会移动整个元素导致边缘露出空白）。
  position 在 40%~60% 之间循环，配合 125% 缩放，任一方向至少留有 10% 余量，
  确保上下左右浮动都不会露出边界。
*/
.bg-layer.is-animated {
  animation: bg-float 30s ease-in-out infinite;
  background-size: 125% 125%;
  will-change: background-position;
}
@keyframes bg-float {
  0%   { background-position: 50% 50%; }
  20%  { background-position: 40% 40%; }
  40%  { background-position: 60% 40%; }
  60%  { background-position: 60% 60%; }
  80%  { background-position: 40% 60%; }
  100% { background-position: 50% 50%; }
}
@media (prefers-reduced-motion: reduce) {
  .bg-layer.is-animated { animation: none; background-size: cover; }
}
.bg-overlay {
  position: absolute; inset: 0;
  background: radial-gradient(1200px 600px at 20% 10%, var(--bg-grad-1), transparent 60%),
    radial-gradient(1000px 700px at 90% 90%, var(--bg-grad-2), transparent 55%);
  opacity: var(--bg-overlay-opacity, 0.85);
}
.dark .bg-overlay { opacity: var(--bg-overlay-opacity, 0.7); background: rgba(8,12,24,0.55); }
</style>
