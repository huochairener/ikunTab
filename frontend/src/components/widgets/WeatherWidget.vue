<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Cloud, CloudRain, CloudSnow, Sun, CloudLightning, Wind, Droplets, MapPin } from 'lucide-vue-next'
import type { Widget } from '@/types'
import type { WeatherConfig } from '@/types'
import { api } from '@/api'

const props = defineProps<{ widget: Widget }>()
const cfg = computed<WeatherConfig>(() => {
  try { return JSON.parse(props.widget.config || '{}') } catch { return {} }
})

interface WeatherResp {
  city?: string
  temperature?: number
  description?: string
  humidity?: number
  wind?: number
  icon?: string
}

const data = ref<WeatherResp>({})
const loading = ref(true)
const err = ref('')

onMounted(async () => {
  try {
    // 优先使用浏览器定位
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const html = await api.weather(cfg.value.city, pos.coords.latitude, pos.coords.longitude)
            data.value = parseHtml(html)
            loading.value = false
          } catch (e) {
            await fallbackCity()
          }
        },
        async () => {
          await fallbackCity()
        },
        { timeout: 5000 },
      )
    } else {
      await fallbackCity()
    }
  } catch (e: any) {
    err.value = e.message
    loading.value = false
  }
})

async function fallbackCity() {
  try {
    const html = await api.weather(cfg.value.city)
    data.value = parseHtml(html)
  } catch (e: any) {
    err.value = e.message
  } finally {
    loading.value = false
  }
}

// 简易解析：返回的字符串里若包含 JSON 则用，否则包装一下
function parseHtml(s: string): WeatherResp {
  try {
    return JSON.parse(s)
  } catch {
    return { description: s.slice(0, 80) }
  }
}

function iconFor(desc: string) {
  const d = (desc || '').toLowerCase()
  if (d.includes('雨')) return CloudRain
  if (d.includes('雪')) return CloudSnow
  if (d.includes('雷')) return CloudLightning
  if (d.includes('晴') || d.includes('sun') || d.includes('clear')) return Sun
  if (d.includes('风')) return Wind
  return Cloud
}
</script>

<template>
  <div class="weather">
    <template v-if="loading">
      <div class="loading">获取中…</div>
    </template>
    <template v-else-if="err">
      <div class="loading err">{{ err }}</div>
    </template>
    <template v-else>
      <div class="main">
        <component :is="iconFor(data.description || '')" :size="32" />
        <div class="temp">{{ data.temperature !== undefined ? Math.round(data.temperature) + '°' : '--°' }}</div>
      </div>
      <div class="info">
        <div class="desc">{{ data.description || '未知' }}</div>
        <div class="city">
          <MapPin :size="11" />
          <span>{{ data.city || cfg.city || '当前位置' }}</span>
        </div>
        <div class="extra">
          <span v-if="data.humidity !== undefined"><Droplets :size="11" /> {{ data.humidity }}%</span>
          <span v-if="data.wind !== undefined"><Wind :size="11" /> {{ data.wind }} km/h</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.weather { height: 100%; display: flex; align-items: center; gap: 12px; padding: 12px; }
.loading { color: var(--text-secondary); font-size: 12px; padding: 12px; }
.loading.err { color: #ff6b6b; }
.main { display: flex; align-items: center; gap: 8px; color: var(--accent); }
.temp { font-size: 26px; font-weight: 600; color: var(--text-primary); }
.info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.desc { font-size: 13px; font-weight: 500; }
.city { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-secondary); }
.extra { display: flex; gap: 10px; font-size: 11px; color: var(--text-secondary); }
.extra span { display: flex; align-items: center; gap: 3px; }
</style>
