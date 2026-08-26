<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { api } from '@/api'

type WeatherKind = 'rain' | 'snow' | 'wind'

const PLAY_DURATION = 12000          // 特效持续时长（ms）
const COOLDOWN = 6 * 60 * 60 * 1000  // 6 小时
const STORAGE_KEY = 'weather_effect_last_ts'
const WIND_GALE_KMH = 38             // 蒲福风级 6 级（强风）阈值 km/h

const activeKind = ref<WeatherKind | null>(null)

const rainDrops = Array.from({ length: 80 }, (_, i) => ({
  left: Math.random() * 100,
  delay: Math.random() * 1.2,
  duration: 0.55 + Math.random() * 0.5,
  length: 40 + Math.random() * 50,
  opacity: 0.25 + Math.random() * 0.45,
  key: i,
}))

const snowFlakes = Array.from({ length: 60 }, (_, i) => ({
  left: Math.random() * 100,
  delay: Math.random() * 3,
  duration: 4 + Math.random() * 4,
  size: 4 + Math.random() * 8,
  opacity: 0.55 + Math.random() * 0.4,
  drift: (Math.random() - 0.5) * 120,
  key: i,
}))

const windLines = Array.from({ length: 24 }, (_, i) => ({
  top: 10 + Math.random() * 70,
  delay: Math.random() * 2,
  duration: 1.1 + Math.random() * 1.4,
  width: 80 + Math.random() * 180,
  opacity: 0.18 + Math.random() * 0.35,
  key: i,
}))

interface WeatherResp {
  city?: string
  temperature?: number
  description?: string
  humidity?: number
  wind?: number
  icon?: string
}

function parseWeather(s: string): WeatherResp {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}

function detectKind(data: WeatherResp): WeatherKind | null {
  const desc = (data.description || '').toLowerCase()
  const wind = typeof data.wind === 'number' ? data.wind : 0
  if (desc.includes('雪')) return 'snow'
  if (desc.includes('雨')) return 'rain'
  if (desc.includes('风') || wind >= WIND_GALE_KMH) return 'wind'
  return null
}

function shouldPlay(): boolean {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return true
  const last = Number(raw)
  if (!Number.isFinite(last)) return true
  return Date.now() - last >= COOLDOWN
}

function markPlayed() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}

let hideTimer: number | null = null

function play(kind: WeatherKind) {
  activeKind.value = kind
  markPlayed()
  if (hideTimer) window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(() => {
    activeKind.value = null
  }, PLAY_DURATION)
}

function fetchWeatherByCity(city?: string): Promise<WeatherResp | null> {
  return api.weather(city).then((s) => (s ? parseWeather(s) : null)).catch(() => null)
}

function tryPlay(data: WeatherResp | null) {
  if (!data) return
  if (!shouldPlay()) return
  const kind = detectKind(data)
  if (kind) play(kind)
}

onMounted(() => {
  // 调试预览：?weather-effect=rain|snow|wind 可强制播放特效（忽略冷却与接口）
  const force = new URLSearchParams(window.location.search).get('weather-effect') as WeatherKind | null
  if (force === 'rain' || force === 'snow' || force === 'wind') {
    play(force)
    return
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        api
          .weather(undefined, pos.coords.latitude, pos.coords.longitude)
          .then((s) => tryPlay(s ? parseWeather(s) : null))
          .catch(() => fetchWeatherByCity().then(tryPlay))
      },
      () => {
        fetchWeatherByCity().then(tryPlay)
      },
      { timeout: 5000 },
    )
  } else {
    fetchWeatherByCity().then(tryPlay)
  }
})

onBeforeUnmount(() => {
  if (hideTimer) window.clearTimeout(hideTimer)
})
</script>

<template>
  <div v-if="activeKind" class="weather-effect" aria-hidden="true">
    <!-- 雨 -->
    <template v-if="activeKind === 'rain'">
      <div
        v-for="d in rainDrops"
        :key="d.key"
        class="rain-drop"
        :style="{
          left: d.left + '%',
          animationDelay: d.delay + 's',
          animationDuration: d.duration + 's',
          height: d.length + 'px',
          opacity: d.opacity,
        }"
      />
    </template>

    <!-- 雪 -->
    <template v-else-if="activeKind === 'snow'">
      <div
        v-for="f in snowFlakes"
        :key="f.key"
        class="snow-flake"
        :style="{
          left: f.left + '%',
          animationDelay: f.delay + 's',
          animationDuration: f.duration + 's',
          width: f.size + 'px',
          height: f.size + 'px',
          opacity: f.opacity,
          '--drift': f.drift + 'px',
        }"
      />
    </template>

    <!-- 大风 -->
    <template v-else-if="activeKind === 'wind'">
      <div
        v-for="w in windLines"
        :key="w.key"
        class="wind-line"
        :style="{
          top: w.top + '%',
          animationDelay: w.delay + 's',
          animationDuration: w.duration + 's',
          width: w.width + 'px',
          opacity: w.opacity,
        }"
      />
    </template>
  </div>
</template>

<style scoped>
.weather-effect {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 200px;
  z-index: 25;           /* 低于顶栏(30)，避免遮挡顶部按钮 */
  pointer-events: none;
  overflow: hidden;
}

/* 雨：斜向短线落下（浅色主题用偏深蓝灰，保证在亮色背景上可见） */
.rain-drop {
  position: absolute;
  top: -40px;
  width: 1.5px;
  background: linear-gradient(to bottom, rgba(90, 120, 170, 0), rgba(80, 110, 165, 0.75));
  border-radius: 2px;
  transform: rotate(14deg);
  animation-name: rain-fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
:global(.dark) .rain-drop {
  background: linear-gradient(to bottom, rgba(160, 200, 255, 0), rgba(170, 210, 255, 0.9));
}
@keyframes rain-fall {
  0%   { transform: translate3d(0, -30px, 0) rotate(14deg); }
  100% { transform: translate3d(-40px, 260px, 0) rotate(14deg); }
}

/* 雪：下落 + 左右飘动 */
.snow-flake {
  position: absolute;
  top: -20px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #ffffff, rgba(200, 220, 250, 0.85));
  box-shadow: 0 0 6px rgba(120, 150, 200, 0.45);
  animation-name: snow-fall;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}
:global(.dark) .snow-flake {
  background: radial-gradient(circle at 30% 30%, #ffffff, rgba(255, 255, 255, 0.6));
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.6);
}
@keyframes snow-fall {
  0%   { transform: translate3d(0, -20px, 0) rotate(0deg); }
  50%  { transform: translate3d(var(--drift, 40px), 120px, 0) rotate(180deg); }
  100% { transform: translate3d(calc(var(--drift, 40px) * -0.4), 240px, 0) rotate(360deg); }
}

/* 大风：横向掠过的线条（浅色主题用深灰蓝） */
.wind-line {
  position: absolute;
  left: -260px;
  height: 1.5px;
  background: linear-gradient(
    to right,
    rgba(90, 110, 150, 0) 0%,
    rgba(80, 100, 145, 0.7) 50%,
    rgba(90, 110, 150, 0) 100%
  );
  border-radius: 2px;
  filter: blur(0.4px);
  animation-name: wind-blow;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
:global(.dark) .wind-line {
  background: linear-gradient(
    to right,
    rgba(180, 210, 255, 0) 0%,
    rgba(180, 210, 255, 0.75) 50%,
    rgba(180, 210, 255, 0) 100%
  );
}
@keyframes wind-blow {
  0%   { transform: translate3d(0, 0, 0); opacity: 0; }
  15%  { opacity: 1; }
  85%  { opacity: 1; }
  100% { transform: translate3d(calc(100vw + 260px), 0, 0); opacity: 0; }
}
</style>
