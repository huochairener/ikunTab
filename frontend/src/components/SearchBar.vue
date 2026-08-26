<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search, ChevronDown } from 'lucide-vue-next'
import { useAppStore } from '@/store/app'
import { api } from '@/api'

const app = useAppStore()
const keyword = ref('')
const open = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

const current = computed(() => {
  const id = app.settings?.searchEngineId
  return app.engines.find((e) => e.id === id) || app.defaultEngine
})

function search() {
  const q = keyword.value.trim()
  if (!q || !current.value) return
  const url = current.value.urlTemplate.replace('{q}', encodeURIComponent(q))
  window.open(url, '_self')
}

async function pick(id: number) {
  if (id === app.settings?.searchEngineId) {
    open.value = false
    return
  }
  open.value = false
  // PUT 已返回完整 settings，无需再发一次 GET，减少一次往返和状态抖动
  app.settings = await api.updateSettings({ searchEngineId: id })
}

// 暴露聚焦方法，供父组件在过渡完成后调用
function focus() {
  inputRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="search">
    <div class="bar glass">
      <button class="engine" @click="open = !open">
        <span class="e-icon">{{ current?.icon || '🔍' }}</span>
        <span class="e-name">{{ current?.name || '搜索引擎' }}</span>
        <ChevronDown :size="14" />
      </button>
      <input
        ref="inputRef"
        v-model="keyword"
        class="kw"
        placeholder="输入并回车搜索…"
        @keydown.enter="search"
      />
      <button class="go" @click="search"><Search :size="18" /></button>
    </div>
    <transition name="fade">
      <div v-if="open" class="menu glass" @click.self="open = false">
        <button
          v-for="e in app.engines"
          :key="e.id"
          class="mi"
          :class="{ on: e.id === current?.id }"
          @click="pick(e.id)"
        >
          <span class="e-icon">{{ e.icon || '🔍' }}</span>{{ e.name }}
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.search { position: relative; width: min(620px, 86vw); }
.bar {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 6px 6px 12px; border-radius: 999px;
  /* 移除 backdrop-filter，避免光标闪烁触发合成层重绘导致 border 边缘闪烁 */
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.engine {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-radius: 999px; border: none;
  background: transparent; color: var(--text-secondary); cursor: pointer; font-size: 13px;
}
.engine:hover { background: var(--input-bg); }
.e-icon { font-size: 14px; }
.kw {
  flex: 1; border: none; background: transparent; outline: none;
  font-size: 15px; color: var(--text-primary); padding: 8px 6px;
  caret-color: var(--text-primary);
}
.go {
  width: 38px; height: 38px; border-radius: 50%; border: none; cursor: pointer;
  background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center;
}
.go:hover { filter: brightness(1.1); }
.menu {
  position: absolute; top: 56px; left: 0; min-width: 180px;
  border-radius: 14px; padding: 6px; display: flex; flex-direction: column; gap: 2px; z-index: 30;
}
.mi {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px;
  border: none; background: transparent; color: var(--text-primary);
  cursor: pointer; border-radius: 10px; font-size: 13px; text-align: left;
}
.mi:hover { background: var(--input-bg); }
.mi.on { color: var(--accent); }
</style>
