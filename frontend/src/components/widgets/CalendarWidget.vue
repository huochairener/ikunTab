<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const today = new Date()
const year = ref(today.getFullYear())
const month = ref(today.getMonth())

const weeks = computed(() => {
  const first = new Date(year.value, month.value, 1)
  const startDay = first.getDay() // 0=日
  const daysInMonth = new Date(year.value, month.value + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  // 切成周
  const w: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) w.push(cells.slice(i, i + 7))
  return w
})

const monthName = computed(() => `${year.value}年 ${month.value + 1}月`)
const isToday = (d: number | null) =>
  d === today.getDate() &&
  month.value === today.getMonth() &&
  year.value === today.getFullYear()

function prev() {
  month.value--
  if (month.value < 0) {
    month.value = 11
    year.value--
  }
}
function next() {
  month.value++
  if (month.value > 11) {
    month.value = 0
    year.value++
  }
}
</script>

<template>
  <div class="cal">
    <header>
      <span class="title">{{ monthName }}</span>
      <div class="nav">
        <button @click="prev"><ChevronLeft :size="16" /></button>
        <button @click="next"><ChevronRight :size="16" /></button>
      </div>
    </header>
    <div class="weekdays">
      <span v-for="w in ['日', '一', '二', '三', '四', '五', '六']" :key="w">{{ w }}</span>
    </div>
    <div class="days">
      <template v-for="(week, wi) in weeks" :key="wi">
        <span
          v-for="(d, di) in week"
          :key="wi + '-' + di"
          class="day"
          :class="{ today: isToday(d), empty: d === null }"
        >{{ d || '' }}</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.cal { height: 100%; display: flex; flex-direction: column; padding: 12px; font-size: 12px; }
header {
  display: flex; align-items: center;
  margin-bottom: 8px; padding-right: 30px; /* 避让组件编辑/删除按钮 */
}
.title { font-weight: 600; font-size: 13px; }
.nav { display: flex; gap: 2px; }
.nav button {
  border: none; background: transparent; color: var(--text-secondary);
  cursor: pointer; padding: 2px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
}
.nav button:hover { background: var(--input-bg); color: var(--text-primary); }

.weekdays { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 4px; }
.weekdays span {
  text-align: center; font-size: 11px; color: var(--text-secondary);
  padding: 4px 0;
}

.days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; flex: 1; }
.day {
  display: flex; align-items: center; justify-content: center;
  border-radius: 6px;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}
.day.today {
  background: var(--accent); color: #fff;
  font-weight: 600;
}
.day.empty { color: transparent; }
.day:not(.today):not(.empty):hover { background: var(--input-bg); cursor: default; }
</style>
