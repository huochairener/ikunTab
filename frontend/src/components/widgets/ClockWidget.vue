<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Widget } from '@/types'
import type { ClockConfig } from '@/types'

const props = defineProps<{ widget: Widget }>()
const cfg = computed<ClockConfig>(() => {
  try { return JSON.parse(props.widget.config || '{}') } catch { return { format: '24' } }
})

const now = ref(new Date())
let timer: number | undefined

onMounted(() => {
  timer = window.setInterval(() => (now.value = new Date()), 1000)
})
onUnmounted(() => { if (timer) window.clearInterval(timer) })

const time = computed(() => {
  const h = now.value.getHours()
  const m = now.value.getMinutes()
  const s = now.value.getSeconds()
  if (cfg.value.format === '12') {
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} ${ampm}`
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const date = computed(() => {
  const d = now.value
  const w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${w}`
})
</script>

<template>
  <div class="clock">
    <div class="time">{{ time }}</div>
    <div class="date">{{ date }}</div>
  </div>
</template>

<style scoped>
.clock {
  height: 100%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px;
  padding: 10px;
}
.time {
  font-family: var(--font-mono);
  font-size: 28px;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.date {
  font-size: 11px;
  color: var(--text-secondary);
}
</style>
