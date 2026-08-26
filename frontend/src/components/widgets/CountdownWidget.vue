<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { Cake } from 'lucide-vue-next'
import type { Widget } from '@/types'
import type { CountdownConfig } from '@/types'

const props = defineProps<{ widget: Widget }>()
const cfg = computed<CountdownConfig>(() => {
  try { return JSON.parse(props.widget.config || '{}') } catch { return { name: '', date: '' } }
})

const now = ref(new Date())
let timer: number | undefined
onMounted(() => {
  timer = window.setInterval(() => (now.value = new Date()), 60000)
})
onUnmounted(() => { if (timer) window.clearInterval(timer) })

const target = computed(() => cfg.value.date ? new Date(cfg.value.date) : null)

const daysLeft = computed(() => {
  if (!target.value) return null
  const diff = target.value.getTime() - now.value.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
})

const display = computed(() => {
  const d = daysLeft.value
  if (d === null) return '--'
  if (d === 0) return '今天'
  if (d > 0) return `还有 ${d} 天`
  return `已过 ${-d} 天`
})

const formattedDate = computed(() => {
  if (!target.value) return ''
  const t = target.value
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
})
</script>

<template>
  <div class="cd">
    <div class="icon"><Cake :size="22" /></div>
    <div class="info">
      <div class="name">{{ cfg.name || '倒数日' }}</div>
      <div class="left" :class="{ past: (daysLeft ?? 0) < 0 }">{{ display }}</div>
      <div class="date">{{ formattedDate }}</div>
    </div>
  </div>
</template>

<style scoped>
.cd {
  height: 100%;
  display: flex; align-items: center; gap: 14px;
  padding: 14px;
}
.icon {
  width: 44px; height: 44px; border-radius: 12px;
  background: var(--input-bg); color: var(--accent);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.name { font-size: 13px; font-weight: 500; color: var(--text-primary); }
.left { font-size: 22px; font-weight: 600; color: var(--accent); }
.left.past { color: var(--text-secondary); }
.date { font-size: 11px; color: var(--text-secondary); }
</style>
