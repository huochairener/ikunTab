<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Flame, RefreshCw, ExternalLink } from 'lucide-vue-next'
import type { Widget } from '@/types'
import type { HotlistConfig } from '@/types'
import { api } from '@/api'

const props = defineProps<{ widget: Widget }>()
const cfg = computed<HotlistConfig>(() => {
  try { return JSON.parse(props.widget.config || '{}') } catch { return { source: 'weibo' } }
})

interface HotItem { title: string; url?: string; hot?: string }
const items = ref<HotItem[]>([])
const loading = ref(true)
const refreshing = ref(false)
const err = ref('')

const sourceLabel = computed(() => {
  const m: Record<string, string> = {
    weibo: '微博热搜',
    douyin: '抖音热榜',
    bilibili: '哔哩哔哩',
    toutiao: '今日头条',
    zhihu: '知乎',
    baidu: '百度热搜',
  }
  return m[cfg.value.source] || cfg.value.source
})

async function load() {
  refreshing.value = true
  err.value = ''
  try {
    const html = await api.hotlist(cfg.value.source)
    items.value = parseHtml(html)
  } catch (e: any) {
    err.value = e.message || '加载失败'
    items.value = []
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

// 解析后端返回的内容：尝试 JSON 数组，否则按行拆分
function parseHtml(s: string): HotItem[] {
  try {
    const arr = JSON.parse(s)
    if (Array.isArray(arr)) return arr.slice(0, 20)
  } catch { /* ignore */ }
  return s
    .split(/\n|<br\/?>|<li[^>]*>/i)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((t) => ({ title: t.replace(/<[^>]+>/g, '') }))
}

function open(url?: string) {
  if (url) window.open(url, '_blank')
}

onMounted(load)
</script>

<template>
  <div class="hl">
    <header>
      <span class="src"><Flame :size="13" /> {{ sourceLabel }}</span>
      <button class="refresh" :disabled="refreshing" @click="load">
        <RefreshCw :size="13" :class="{ spin: refreshing }" />
      </button>
    </header>
    <div class="list">
      <div v-if="loading" class="empty">加载中…</div>
      <div v-else-if="err" class="empty err">{{ err }}</div>
      <template v-else>
        <a
          v-for="(it, i) in items"
          :key="i"
          class="row"
          :class="{ clickable: it.url }"
          @click="open(it.url)"
        >
          <span class="rank" :class="{ top: i < 3 }">{{ i + 1 }}</span>
          <span class="title" :title="it.title">{{ it.title }}</span>
          <span v-if="it.hot" class="hot">{{ it.hot }}</span>
          <ExternalLink v-if="it.url" :size="11" class="ext" />
        </a>
      </template>
    </div>
  </div>
</template>

<style scoped>
.hl {
  height: 100%;
  display: flex; flex-direction: column;
  padding: 10px;
}
header {
  display: flex; align-items: center; gap: 6px;
  padding-bottom: 6px; padding-right: 30px; /* 避让组件编辑/删除按钮 */
  border-bottom: 1px solid var(--glass-border);
  margin-bottom: 6px;
}
.src {
  display: flex; align-items: center; gap: 4px;
  font-size: 12px; font-weight: 500;
  color: var(--accent-2);
}
.refresh {
  border: none; background: transparent; cursor: pointer;
  color: var(--text-secondary); padding: 4px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
}
.refresh:hover { background: var(--input-bg); }
.refresh:disabled { cursor: not-allowed; opacity: 0.5; }
.spin { animation: sp 1s linear infinite; }
@keyframes sp { to { transform: rotate(360deg); } }

.list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 1px; }
.row {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 4px; border-radius: 6px;
  font-size: 12px;
  color: var(--text-primary);
}
.row.clickable { cursor: pointer; }
.row.clickable:hover { background: var(--input-bg); }
.rank {
  flex-shrink: 0;
  width: 18px; height: 18px;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
.rank.top { color: var(--accent-2); }
.title {
  flex: 1; min-width: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.hot { font-size: 10px; color: var(--text-secondary); flex-shrink: 0; }
.ext { color: var(--text-secondary); flex-shrink: 0; }
.empty { color: var(--text-secondary); font-size: 12px; padding: 12px; text-align: center; }
.empty.err { color: #ff6b6b; }
</style>
