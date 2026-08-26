<script setup lang="ts">
import { onMounted } from 'vue'
import { useUserStore } from '@/store/user'
import { useAppStore } from '@/store/app'

const user = useUserStore()
const app = useAppStore()

onMounted(async () => {
  // 应用初始主题（避免闪烁）
  const saved = localStorage.getItem('theme') as 'light' | 'dark' | null
  const resolved =
    saved ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  document.documentElement.classList.add(resolved)

  await user.init()
  if (user.user) {
    try {
      await app.loadAll()
    } catch (e) {
      console.error('加载配置失败', e)
    }
  }
})
</script>

<template>
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
</template>
