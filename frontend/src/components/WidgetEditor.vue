<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { X } from 'lucide-vue-next'
import type { Widget } from '@/types'
import { api } from '@/api'

const props = defineProps<{
  widget: Widget | null
  groupId: number
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
}>()

const type = ref<Widget['type']>('clock')
const name = ref('')
const rows = ref(1)
const cols = ref(1)
const enabled = ref(true)
const err = ref('')

// 各类型 config
const cfgHotlist = ref<{ source: string }>({ source: 'weibo' })
const cfgWeather = ref<{ city?: string }>({})
const cfgClock = ref<{ format: '12' | '24' }>({ format: '24' })
const cfgCountdown = ref<{ name: string; date: string }>({ name: '', date: '' })
const cfgCustom = ref<{
  outerUrl: string
  clickBehavior: 'iframe' | 'popup' | 'none'
  popupUrl?: string
}>({
  outerUrl: '',
  clickBehavior: 'iframe',
  popupUrl: '',
})

const isEdit = computed(() => !!props.widget)
const titleText = computed(() => isEdit.value ? '编辑组件' : '添加组件')

onMounted(() => {
  if (props.widget) {
    type.value = props.widget.type
    name.value = props.widget.name || ''
    rows.value = props.widget.rows || 1
    cols.value = props.widget.cols || 1
    enabled.value = props.widget.enabled === 1
    const cfg = safeParse(props.widget.config)
    if (type.value === 'hotlist') cfgHotlist.value = { source: cfg.source || 'weibo' }
    else if (type.value === 'weather') cfgWeather.value = { city: cfg.city || '' }
    else if (type.value === 'clock') cfgClock.value = { format: cfg.format || '24' }
    else if (type.value === 'countdown') cfgCountdown.value = { name: cfg.name || '', date: cfg.date || '' }
    else if (type.value === 'custom') cfgCustom.value = {
      outerUrl: cfg.outerUrl || '',
      clickBehavior: cfg.clickBehavior || 'iframe',
      popupUrl: cfg.popupUrl || '',
    }
  }
})

function safeParse(s: string): any {
  try { return JSON.parse(s || '{}') } catch { return {} }
}

const typeOptions: { value: Widget['type']; label: string; desc: string }[] = [
  { value: 'clock', label: '时钟', desc: '实时显示当前时间和日期' },
  { value: 'calendar', label: '万年历', desc: '可翻月的日历' },
  { value: 'weather', label: '天气', desc: '基于定位或自定义城市' },
  { value: 'hotlist', label: '热榜', desc: '微博、抖音、B站等实时热搜' },
  { value: 'countdown', label: '倒数日', desc: '重要日子倒计时' },
  { value: 'custom', label: '自定义内嵌框架', desc: '嵌入任意网址作为组件' },
]

const hotSources = [
  { value: 'weibo', label: '微博热搜' },
  { value: 'douyin', label: '抖音热榜' },
  { value: 'bilibili', label: '哔哩哔哩' },
  { value: 'toutiao', label: '今日头条' },
  { value: 'zhihu', label: '知乎热榜' },
  { value: 'baidu', label: '百度热搜' },
]

async function save() {
  err.value = ''
  if (type.value === 'custom' && !cfgCustom.value.outerUrl) {
    err.value = '请填写外层网址'
    return
  }
  if (type.value === 'countdown' && !cfgCountdown.value.date) {
    err.value = '请选择倒数日期'
    return
  }

  let config = ''
  switch (type.value) {
    case 'hotlist': config = JSON.stringify(cfgHotlist.value); break
    case 'weather': config = JSON.stringify(cfgWeather.value); break
    case 'clock': config = JSON.stringify(cfgClock.value); break
    case 'countdown': config = JSON.stringify(cfgCountdown.value); break
    case 'custom': config = JSON.stringify(cfgCustom.value); break
    default: config = '{}'
  }

  const payload: any = {
    groupId: props.groupId,
    type: type.value,
    name: name.value || null,
    rows: rows.value,
    cols: cols.value,
    enabled: enabled.value ? 1 : 0,
    config,
  }

  try {
    if (isEdit.value && props.widget) {
      await api.updateWidget(props.widget.id, payload)
    } else {
      await api.saveWidget(payload)
    }
    emit('saved')
  } catch (e: any) {
    err.value = e.message || '保存失败'
  }
}
</script>

<template>
  <Teleport to="body">
  <div class="mask" @click.self="emit('close')">
    <div class="modal glass">
      <header>
        <h3>{{ titleText }}</h3>
        <button class="x" @click="emit('close')"><X :size="18" /></button>
      </header>

      <div class="form">
        <!-- 类型选择 -->
        <div v-if="!isEdit" class="field">
          <span>组件类型</span>
          <div class="types">
            <button
              v-for="t in typeOptions"
              :key="t.value"
              :class="['type', type === t.value ? 'on' : '']"
              @click="type = t.value"
            >
              <span class="t-name">{{ t.label }}</span>
              <span class="t-desc">{{ t.desc }}</span>
            </button>
          </div>
        </div>

        <!-- 名称 -->
        <label class="field">
          <span>组件名称（可选）</span>
          <input v-model="name" class="input" placeholder="例如 我的博客" />
        </label>

        <!-- 尺寸 -->
        <div class="field">
          <span>组件尺寸（行 × 列）</span>
          <div class="size-row">
            <label>
              行
              <input v-model.number="rows" type="number" min="1" max="4" class="input num" />
            </label>
            <label>
              列
              <input v-model.number="cols" type="number" min="1" max="4" class="input num" />
            </label>
            <div class="preview-grid">
              <div
                v-for="r in 4"
                :key="r"
                class="pg-row"
              >
                <div
                  v-for="c in 4"
                  :key="c"
                  class="pg-cell"
                  :class="{ on: r <= rows && c <= cols }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 时钟 -->
        <div v-if="type === 'clock'" class="field">
          <span>时间格式</span>
          <div class="tabs">
            <button :class="['tab', cfgClock.format === '24' ? 'on' : '']" @click="cfgClock.format = '24'">24 小时制</button>
            <button :class="['tab', cfgClock.format === '12' ? 'on' : '']" @click="cfgClock.format = '12'">12 小时制</button>
          </div>
        </div>

        <!-- 天气 -->
        <label v-if="type === 'weather'" class="field">
          <span>城市（留空则使用定位）</span>
          <input v-model="cfgWeather.city" class="input" placeholder="例如 北京" />
        </label>

        <!-- 热榜 -->
        <div v-if="type === 'hotlist'" class="field">
          <span>热搜来源</span>
          <select v-model="cfgHotlist.source" class="input">
            <option v-for="s in hotSources" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </div>

        <!-- 倒数日 -->
        <template v-if="type === 'countdown'">
          <label class="field">
            <span>事件名称</span>
            <input v-model="cfgCountdown.name" class="input" placeholder="例如 生日" />
          </label>
          <label class="field">
            <span>目标日期</span>
            <input v-model="cfgCountdown.date" type="date" class="input" />
          </label>
        </template>

        <!-- 自定义内嵌框架 -->
        <template v-if="type === 'custom'">
          <label class="field">
            <span>外层网址</span>
            <input v-model="cfgCustom.outerUrl" class="input" placeholder="https://example.com" />
          </label>
          <div class="field">
            <span>点击行为</span>
            <div class="tabs">
              <button :class="['tab', cfgCustom.clickBehavior === 'iframe' ? 'on' : '']" @click="cfgCustom.clickBehavior = 'iframe'">内嵌网页</button>
              <button :class="['tab', cfgCustom.clickBehavior === 'popup' ? 'on' : '']" @click="cfgCustom.clickBehavior = 'popup'">打开弹窗</button>
              <button :class="['tab', cfgCustom.clickBehavior === 'none' ? 'on' : '']" @click="cfgCustom.clickBehavior = 'none'">无</button>
            </div>
          </div>
          <label v-if="cfgCustom.clickBehavior === 'popup'" class="field">
            <span>弹窗网址（留空则使用外层网址）</span>
            <input v-model="cfgCustom.popupUrl" class="input" placeholder="https://example.com/popup" />
          </label>
        </template>

        <!-- 启用 -->
        <label class="field check">
          <input v-model="enabled" type="checkbox" />
          <span>启用该组件</span>
        </label>
      </div>

      <footer>
        <p v-if="err" class="err">{{ err }}</p>
        <div class="actions">
          <button class="btn btn-ghost" @click="emit('close')">取消</button>
          <button class="btn btn-primary" @click="save">保存</button>
        </div>
      </footer>
    </div>
  </div>
  </Teleport>
</template>

<style scoped>
.mask {
  position: fixed; inset: 0; z-index: 90;
  background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(2px);
}
.modal {
  width: min(620px, 94vw); max-height: 88vh; overflow-y: auto;
  border-radius: 18px; padding: 22px;
}
header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
header h3 { font-size: 17px; margin: 0; font-weight: 600; }
.x { border: none; background: transparent; color: var(--text-secondary); cursor: pointer; padding: 4px; border-radius: 8px; }
.x:hover { background: var(--input-bg); }

.form { display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field > span { font-size: 12px; color: var(--text-secondary); }
.field.check { flex-direction: row; align-items: center; gap: 8px; }

.types {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;
}
.type {
  text-align: left;
  padding: 10px 12px; border-radius: 10px;
  border: 1px solid var(--glass-border);
  background: var(--input-bg); cursor: pointer;
  display: flex; flex-direction: column; gap: 3px;
  transition: all 0.15s;
}
.type.on { border-color: var(--accent); background: var(--card-bg); }
.type:hover { border-color: var(--accent); }
.t-name { font-size: 13px; font-weight: 500; color: var(--text-primary); }
.t-desc { font-size: 11px; color: var(--text-secondary); }

.size-row { display: flex; align-items: center; gap: 14px; }
.size-row label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary); }
.num { width: 60px; }

.preview-grid {
  display: grid; grid-template-columns: repeat(4, 10px); grid-template-rows: repeat(4, 10px);
  gap: 2px; padding: 4px; background: var(--input-bg); border-radius: 4px;
}
.pg-cell {
  width: 10px; height: 10px;
  background: var(--glass-border);
  border-radius: 2px;
}
.pg-cell.on { background: var(--accent); }

.tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.tab {
  padding: 8px 12px; border-radius: 8px; border: 1px solid var(--glass-border);
  background: transparent; color: var(--text-secondary); cursor: pointer; font-size: 12px;
  transition: all 0.15s;
}
.tab.on { background: var(--accent); color: #fff; border-color: var(--accent); }

footer { display: flex; align-items: center; justify-content: space-between; margin-top: 18px; }
.err { color: #ff6b6b; font-size: 12px; margin: 0; }
.actions { display: flex; gap: 8px; }
</style>
