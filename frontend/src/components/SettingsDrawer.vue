<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { X, Sun, Moon, Monitor, Image as ImageIcon, Upload, Search, Trash2, RefreshCw, Plus, Pencil, ExternalLink, ArrowRight, Repeat2, Layers, Droplets, Maximize2, ZoomIn, Ban, Palette, RotateCcw } from 'lucide-vue-next'
import { useAppStore } from '@/store/app'
import { useUserStore } from '@/store/user'
import { api } from '@/api'
import type { SearchEngine, TransitionAnimation } from '@/types'

const app = useAppStore()
const user = useUserStore()
const emit = defineEmits<{ (e: 'close'): void }>()

const tab = ref<'general' | 'background' | 'engines'>('general')

/* ============ 通用：主题 ============ */
const theme = ref<'light' | 'dark' | 'auto'>('light')
onMounted(() => {
  theme.value = app.settings?.theme || 'light'
})

async function applyTheme(t: 'light' | 'dark' | 'auto') {
  theme.value = t
  app.settings = await api.updateSettings({ theme: t })
  app.applySettings()
}

/* ============ 通用：书签打开方式 ============ */
const openTarget = ref<'new' | 'self'>('new')
onMounted(() => {
  openTarget.value = app.settings?.bookmarkOpenTarget === 'self' ? 'self' : 'new'
})

async function applyOpenTarget(t: 'new' | 'self') {
  openTarget.value = t
  app.settings = await api.updateSettings({ bookmarkOpenTarget: t })
}

/* ============ 通用：自动聚焦搜索框 ============ */
const autoFocus = ref(1)
const autoFocusSaving = ref(false)
onMounted(() => {
  autoFocus.value = app.settings?.autoFocusSearch ?? 1
})

async function toggleAutoFocus() {
  autoFocusSaving.value = true
  const next = autoFocus.value === 1 ? 0 : 1
  try {
    autoFocus.value = next
    app.settings = await api.updateSettings({ autoFocusSearch: next })
  } finally {
    autoFocusSaving.value = false
  }
}

/* ============ 通用：分组切换过渡动画 ============ */
const transitionOptions: { value: TransitionAnimation; label: string; icon: any }[] = [
  { value: 'flip', label: '翻转', icon: Repeat2 },
  { value: 'stack', label: '层叠', icon: Layers },
  { value: 'fade', label: '渐隐', icon: Droplets },
  { value: 'spread', label: '扩散', icon: Maximize2 },
  { value: 'zoom', label: '缩小', icon: ZoomIn },
  { value: 'none', label: '无动画', icon: Ban },
]
const transitionAnim = ref<TransitionAnimation>('flip')
const transitionSaving = ref(false)
onMounted(() => {
  transitionAnim.value = app.settings?.transitionAnimation || 'flip'
})
async function applyTransition(v: TransitionAnimation) {
  if (transitionAnim.value === v) return
  transitionSaving.value = true
  try {
    transitionAnim.value = v
    app.settings = await api.updateSettings({ transitionAnimation: v })
  } finally {
    transitionSaving.value = false
  }
}

/* ============ 通用：主题色 ============ */
const colorPresets = [
  { name: '青绿', light: '#1fb6a6', dark: '#2dd4bf' },
  { name: '靛蓝', light: '#3b82f6', dark: '#60a5fa' },
  { name: '紫罗兰', light: '#8b5cf6', dark: '#a78bfa' },
  { name: '樱粉', light: '#ec4899', dark: '#f472b6' },
  { name: '丹橙', light: '#f97316', dark: '#fb923c' },
  { name: '朱红', light: '#ef4444', dark: '#f87171' },
  { name: '柠黄', light: '#eab308', dark: '#facc15' },
  { name: '森绿', light: '#10b981', dark: '#34d399' },
]
const primaryColor = ref<string>('')
const customColor = ref<string>('#1fb6a6')
const colorSaving = ref(false)

onMounted(() => {
  const saved = app.settings?.primaryColor || ''
  primaryColor.value = saved
  if (saved) customColor.value = saved
})

function isPresetActive(p: { light: string; dark: string }) {
  const c = primaryColor.value.toLowerCase()
  return c === p.light.toLowerCase() || c === p.dark.toLowerCase()
}

async function applyPrimaryColor(color: string | null) {
  colorSaving.value = true
  try {
    primaryColor.value = color || ''
    if (color) customColor.value = color
    app.applyPrimaryColor(color)
    app.settings = await api.updateSettings({ primaryColor: color })
  } finally {
    colorSaving.value = false
  }
}

async function onCustomColorChange(e: Event) {
  const v = (e.target as HTMLInputElement).value
  await applyPrimaryColor(v)
}

async function resetPrimaryColor() {
  await applyPrimaryColor(null)
}

/* ============ 通用：界面透明度 ============ */
const uiOpacity = ref(100)
let uiSaveTimer: number | null = null
onMounted(() => {
  uiOpacity.value = app.settings?.uiOpacity ?? 100
})

function onUiOpacityInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  uiOpacity.value = v
  // 本地立即预览
  if (app.settings) app.settings.uiOpacity = v
  app.applyOpacity()
  if (uiSaveTimer) window.clearTimeout(uiSaveTimer)
  uiSaveTimer = window.setTimeout(async () => {
    app.settings = await api.updateSettings({ uiOpacity: v })
  }, 250)
}

/* ============ 背景：背景遮罩透明度 ============ */
const bgOverlayOpacity = ref(100)
let bgSaveTimer: number | null = null
onMounted(() => {
  bgOverlayOpacity.value = app.settings?.bgOverlayOpacity ?? 100
})

function onBgOverlayOpacityInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  bgOverlayOpacity.value = v
  if (app.settings) app.settings.bgOverlayOpacity = v
  app.applyOpacity()
  if (bgSaveTimer) window.clearTimeout(bgSaveTimer)
  bgSaveTimer = window.setTimeout(async () => {
    app.settings = await api.updateSettings({ bgOverlayOpacity: v })
  }, 250)
}

/* ============ 背景 ============ */
const bgType = ref<'upload' | 'random' | 'bing'>('bing')
const bgValue = ref('')
const bgPreview = ref<string | null>(null)
const bgLoading = ref(false)
const bgAnimation = ref(0)
const animSaving = ref(false)

onMounted(() => {
  bgType.value = app.settings?.backgroundType || 'bing'
  bgValue.value = app.settings?.backgroundValue || ''
  bgAnimation.value = app.settings?.backgroundAnimation || 0
  refreshBgPreview()
})

function refreshBgPreview() {
  if (bgType.value === 'random' && bgValue.value) {
    const sep = bgValue.value.includes('?') ? '&' : '?'
    bgPreview.value = `${bgValue.value}${sep}t=${Date.now()}`
  } else if (bgType.value === 'upload' && bgValue.value) {
    bgPreview.value = bgValue.value
  } else if (bgType.value === 'bing') {
    bgPreview.value = `https://api.dujin.org/bing/300.php?t=${Date.now()}`
  } else {
    bgPreview.value = null
  }
}

async function applyBackground() {
  bgLoading.value = true
  try {
    app.settings = await api.updateSettings({
      backgroundType: bgType.value,
      backgroundValue: bgValue.value || null,
    })
    refreshBgPreview()
  } finally {
    bgLoading.value = false
  }
}

async function onBgUpload(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files || !input.files[0]) return
  bgLoading.value = true
  try {
    const u = await api.upload(input.files[0])
    bgType.value = 'upload'
    bgValue.value = u
    await applyBackground()
  } finally {
    bgLoading.value = false
  }
}

function useRandomPreset() {
  bgType.value = 'random'
  bgValue.value = 'https://picsum.photos/1920/1080'
  refreshBgPreview()
}

async function toggleAnimation() {
  animSaving.value = true
  const next = bgAnimation.value === 1 ? 0 : 1
  try {
    bgAnimation.value = next
    app.settings = await api.updateSettings({ backgroundAnimation: next })
    app.applySettings()
  } finally {
    animSaving.value = false
  }
}

/* ============ 搜索引擎 ============ */
const engines = computed(() => app.engines)
const editingEngine = ref<SearchEngine | null>(null)
const engineForm = ref({ name: '', urlTemplate: '', icon: '', isDefault: false })
const showEngineForm = ref(false)

function startAddEngine() {
  editingEngine.value = null
  engineForm.value = { name: '', urlTemplate: '', icon: '', isDefault: false }
  showEngineForm.value = true
}

function startEditEngine(e: SearchEngine) {
  editingEngine.value = e
  engineForm.value = {
    name: e.name,
    urlTemplate: e.urlTemplate,
    icon: e.icon || '',
    isDefault: e.isDefault === 1,
  }
  showEngineForm.value = true
}

async function saveEngine() {
  if (!engineForm.value.name || !engineForm.value.urlTemplate) return
  const payload = {
    name: engineForm.value.name,
    urlTemplate: engineForm.value.urlTemplate,
    icon: engineForm.value.icon || null,
    isDefault: engineForm.value.isDefault ? 1 : 0,
  }
  if (editingEngine.value) {
    await api.updateEngine(editingEngine.value.id, payload)
  } else {
    await api.saveEngine(payload)
  }
  showEngineForm.value = false
  app.engines = await api.engines()
}

async function deleteEngine(e: SearchEngine) {
  if (engines.value.length <= 1) {
    alert('至少保留一个搜索引擎')
    return
  }
  if (!confirm(`删除搜索引擎「${e.name}」？`)) return
  await api.deleteEngine(e.id)
  app.engines = await api.engines()
}

async function markDefault(e: SearchEngine) {
  await api.updateEngine(e.id, { isDefault: 1 })
  app.engines = await api.engines()
}

/* ============ 账户：修改密码 ============ */
const pwdForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })
const pwdSaving = ref(false)
const pwdError = ref('')
const pwdDone = ref('')

async function submitPassword() {
  pwdError.value = ''
  pwdDone.value = ''
  if (!pwdForm.value.oldPassword || !pwdForm.value.newPassword) {
    pwdError.value = '请填写当前密码和新密码'
    return
  }
  if (pwdForm.value.newPassword.length < 6) {
    pwdError.value = '新密码至少 6 位'
    return
  }
  if (pwdForm.value.newPassword !== pwdForm.value.confirmPassword) {
    pwdError.value = '两次输入的新密码不一致'
    return
  }
  pwdSaving.value = true
  try {
    await api.changePassword({
      oldPassword: pwdForm.value.oldPassword,
      newPassword: pwdForm.value.newPassword,
    })
    pwdForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
    pwdDone.value = '密码已更新，下次登录请用新密码'
  } catch (e: any) {
    pwdError.value = e.message || '修改失败'
  } finally {
    pwdSaving.value = false
  }
}

/* ============ 退出登录 ============ */
async function logout() {
  await user.logout()
  location.href = '/login'
}
</script>

<template>
  <div class="mask" @click.self="emit('close')">
    <aside class="drawer glass">
      <header class="d-head">
        <h3>设置</h3>
        <button class="x" @click="emit('close')"><X :size="18" /></button>
      </header>

      <nav class="tabs-nav">
        <button :class="{ on: tab === 'general' }" @click="tab = 'general'">通用</button>
        <button :class="{ on: tab === 'background' }" @click="tab = 'background'">背景</button>
        <button :class="{ on: tab === 'engines' }" @click="tab = 'engines'">搜索引擎</button>
      </nav>

      <div class="d-body">
        <!-- 通用：主题 -->
        <div v-if="tab === 'general'">
          <section class="sec">
            <h4>主题</h4>
            <div class="theme-grid">
              <button
                :class="['theme', theme === 'light' ? 'on' : '']"
                @click="applyTheme('light')"
              >
                <Sun :size="22" />
                <span>日间</span>
              </button>
              <button
                :class="['theme', theme === 'dark' ? 'on' : '']"
                @click="applyTheme('dark')"
              >
                <Moon :size="22" />
                <span>夜间</span>
              </button>
              <button
                :class="['theme', theme === 'auto' ? 'on' : '']"
                @click="applyTheme('auto')"
              >
                <Monitor :size="22" />
                <span>跟随系统</span>
              </button>
            </div>
          </section>

          <section class="sec">
            <h4>主题色</h4>
            <div class="color-grid">
              <button
                v-for="p in colorPresets"
                :key="p.name"
                type="button"
                class="color-dot-wrap"
                :title="p.name"
                @click="applyPrimaryColor(p.light)"
              >
                <span
                  class="color-dot"
                  :class="{ on: isPresetActive(p) }"
                  :style="{ background: p.light }"
                ></span>
              </button>
              <label class="color-dot-wrap custom" title="自定义颜色">
                <input
                  type="color"
                  :value="customColor"
                  :disabled="colorSaving"
                  @input="onCustomColorChange"
                />
                <span class="color-dot custom-dot" :style="{ background: customColor }">
                  <Palette :size="14" />
                </span>
              </label>
            </div>
            <button
              class="btn btn-ghost reset-color"
              :disabled="colorSaving || !primaryColor"
              @click="resetPrimaryColor"
            >
              <RotateCcw :size="14" />
              <span>恢复默认</span>
            </button>
            <p class="hint">日间/夜间模式都会使用该主题色</p>
          </section>

          <section class="sec">
            <h4>书签打开方式</h4>
            <div class="theme-grid two-col">
              <button
                :class="['theme', openTarget === 'new' ? 'on' : '']"
                @click="applyOpenTarget('new')"
              >
                <ExternalLink :size="22" />
                <span>新标签页</span>
              </button>
              <button
                :class="['theme', openTarget === 'self' ? 'on' : '']"
                @click="applyOpenTarget('self')"
              >
                <ArrowRight :size="22" />
                <span>当前页</span>
              </button>
            </div>
            <p class="hint">点击书签时的跳转方式</p>
          </section>

          <section class="sec">
            <h4>搜索框</h4>
            <div class="anim-row">
              <div class="anim-info">
                <span class="anim-title">自动聚焦</span>
                <span class="anim-desc">页面加载 / 切换分组后自动把焦点放到搜索框</span>
              </div>
              <button
                class="switch"
                role="switch"
                :aria-checked="autoFocus === 1"
                :class="{ on: autoFocus === 1 }"
                :disabled="autoFocusSaving"
                @click="toggleAutoFocus"
              >
                <span class="knob"></span>
              </button>
            </div>
            <p class="hint">关闭后输入不会被打断，适合习惯在地址栏直接搜索的用户</p>
          </section>

          <section class="sec">
            <h4>界面透明度</h4>
            <div class="slider-row">
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                :value="uiOpacity"
                class="opacity-range"
                @input="onUiOpacityInput"
              />
              <span class="slider-val">{{ uiOpacity }}%</span>
            </div>
            <p class="hint">调整毛玻璃面板、书签卡片、搜索栏、Dock 等界面元素的不透明度</p>
          </section>

          <section class="sec">
            <h4>过渡动画</h4>
            <div class="anim-grid">
              <button
                v-for="opt in transitionOptions"
                :key="opt.value"
                :class="['anim-opt', transitionAnim === opt.value ? 'on' : '']"
                :disabled="transitionSaving"
                @click="applyTransition(opt.value)"
              >
                <component :is="opt.icon" :size="20" />
                <span>{{ opt.label }}</span>
              </button>
            </div>
            <p class="hint">切换分组时页面使用的过渡动画效果</p>
          </section>

          <section class="sec">
            <h4>账户</h4>
            <div class="user-info">
              <div class="u-name">{{ user.user?.username }}</div>
              <div class="u-id">ID: {{ user.user?.id }}</div>
            </div>
            <div class="pwd-form">
              <label class="field">
                <span>当前密码</span>
                <input v-model="pwdForm.oldPassword" type="password" class="input" autocomplete="current-password" />
              </label>
              <label class="field">
                <span>新密码</span>
                <input v-model="pwdForm.newPassword" type="password" class="input" autocomplete="new-password" />
              </label>
              <label class="field">
                <span>确认新密码</span>
                <input v-model="pwdForm.confirmPassword" type="password" class="input" autocomplete="new-password" />
              </label>
              <p v-if="pwdError" class="pwd-msg bad">{{ pwdError }}</p>
              <p v-if="pwdDone" class="pwd-msg good">{{ pwdDone }}</p>
              <button class="btn btn-primary pwd-submit" :disabled="pwdSaving" @click="submitPassword">
                {{ pwdSaving ? '保存中…' : '修改密码' }}
              </button>
            </div>
            <button class="btn btn-ghost logout" @click="logout">退出登录</button>
          </section>
        </div>

        <!-- 背景 -->
        <div v-else-if="tab === 'background'">
          <section class="sec">
            <h4>背景类型</h4>
            <div class="bg-types">
              <button :class="['bg', bgType === 'bing' ? 'on' : '']" @click="bgType = 'bing'; refreshBgPreview()">
                <ImageIcon :size="16" /> 必应每日图
              </button>
              <button :class="['bg', bgType === 'random' ? 'on' : '']" @click="bgType = 'random'; refreshBgPreview()">
                <RefreshCw :size="16" /> 随机图
              </button>
              <button :class="['bg', bgType === 'upload' ? 'on' : '']" @click="bgType = 'upload'; refreshBgPreview()">
                <Upload :size="16" /> 上传图片
              </button>
            </div>
          </section>

          <section v-if="bgType === 'random'" class="sec">
            <h4>随机图网址</h4>
            <input v-model="bgValue" class="input" placeholder="https://picsum.photos/1920/1080" @input="refreshBgPreview" />
            <button class="btn btn-ghost preset" @click="useRandomPreset">使用 picsum 预设</button>
            <p class="hint">每次刷新网站都会重新获取随机图</p>
          </section>

          <section v-if="bgType === 'upload'" class="sec">
            <h4>上传背景</h4>
            <label class="upload">
              <input type="file" accept="image/*" @change="onBgUpload" hidden />
              <Upload :size="16" />
              <span>{{ bgLoading ? '上传中…' : '选择文件' }}</span>
            </label>
          </section>

          <section class="sec">
            <h4>背景遮罩透明度</h4>
            <div class="slider-row">
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                :value="bgOverlayOpacity"
                class="opacity-range"
                @input="onBgOverlayOpacityInput"
              />
              <span class="slider-val">{{ bgOverlayOpacity }}%</span>
            </div>
            <p class="hint">调整背景图上方的渐变遮罩浓度，数值越小背景越清晰</p>
          </section>

          <section class="sec">
            <h4>动效</h4>
            <div class="anim-row">
              <div class="anim-info">
                <span class="anim-title">背景浮动</span>
                <span class="anim-desc">开启后背景图会缓慢上下左右浮动</span>
              </div>
              <button
                class="switch"
                role="switch"
                :aria-checked="bgAnimation === 1"
                :class="{ on: bgAnimation === 1 }"
                :disabled="animSaving"
                @click="toggleAnimation"
              >
                <span class="knob"></span>
              </button>
            </div>
          </section>

          <section class="sec">
            <h4>预览</h4>
            <div class="bg-preview">
              <img v-if="bgPreview" :src="bgPreview" alt="" @error="bgPreview = null" />
              <span v-else class="ph">暂无预览</span>
            </div>
            <button class="btn btn-primary apply" :disabled="bgLoading" @click="applyBackground">
              {{ bgLoading ? '保存中…' : '应用背景' }}
            </button>
          </section>
        </div>

        <!-- 搜索引擎 -->
        <div v-else>
          <section class="sec">
            <div class="sec-head">
              <h4>已配置的搜索引擎</h4>
              <button class="add-btn" @click="startAddEngine"><Plus :size="14" /></button>
            </div>
            <div class="engine-list">
              <div
                v-for="e in engines"
                :key="e.id"
                class="engine-row"
                :class="{ default: e.isDefault === 1 }"
              >
                <span class="e-icon">{{ e.icon || '🔍' }}</span>
                <span class="e-name">{{ e.name }}</span>
                <span v-if="e.isDefault === 1" class="badge">默认</span>
                <button v-else class="mini-btn" @click="markDefault(e)" title="设为默认">设为默认</button>
                <button class="mini-btn" @click="startEditEngine(e)"><Pencil :size="12" /></button>
                <button class="mini-btn danger" @click="deleteEngine(e)"><Trash2 :size="12" /></button>
              </div>
            </div>

            <!-- 编辑表单 -->
            <div v-if="showEngineForm" class="engine-form">
              <h5>{{ editingEngine ? '编辑' : '添加' }}搜索引擎</h5>
              <label class="field">
                <span>名称</span>
                <input v-model="engineForm.name" class="input" placeholder="Bing" />
              </label>
              <label class="field">
                <span>网址模板（用 {q} 占位）</span>
                <input v-model="engineForm.urlTemplate" class="input" placeholder="https://www.bing.com/search?q={q}" />
              </label>
              <label class="field">
                <span>图标（emoji）</span>
                <input v-model="engineForm.icon" class="input" placeholder="🔍" maxlength="2" />
              </label>
              <label class="field check">
                <input v-model="engineForm.isDefault" type="checkbox" />
                <span>设为默认</span>
              </label>
              <div class="actions">
                <button class="btn btn-ghost" @click="showEngineForm = false">取消</button>
                <button class="btn btn-primary" @click="saveEngine">保存</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.mask {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(0, 0, 0, 0.3);
}
.drawer {
  position: absolute; top: 0; right: 0;
  width: min(420px, 92vw); height: 100%;
  border-radius: 0;
  display: flex; flex-direction: column;
  animation: slide-in 0.3s cubic-bezier(0.22, 0.61, 0.36, 1);
}
@keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }

.d-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px 14px;
}
.d-head h3 { font-size: 17px; margin: 0; font-weight: 600; }
.x { border: none; background: transparent; color: var(--text-secondary); cursor: pointer; padding: 4px; border-radius: 8px; }
.x:hover { background: var(--input-bg); }

.tabs-nav {
  display: flex; padding: 0 20px;
  border-bottom: 1px solid var(--glass-border);
}
.tabs-nav button {
  flex: 1; padding: 10px;
  border: none; background: transparent;
  color: var(--text-secondary); cursor: pointer;
  font-size: 13px; font-weight: 500;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}
.tabs-nav button.on {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.d-body { flex: 1; overflow-y: auto; padding: 16px 20px; }
.sec { margin-bottom: 24px; }
.sec-head { display: flex; align-items: center; justify-content: space-between; }
.sec h4 { font-size: 13px; margin: 0 0 10px; color: var(--text-secondary); font-weight: 500; }
.sec h5 { font-size: 13px; margin: 16px 0 10px; font-weight: 500; }

.theme-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.theme-grid.two-col { grid-template-columns: repeat(2, 1fr); }
.theme {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 14px 6px;
  border: 1px solid var(--glass-border); border-radius: 12px;
  background: var(--input-bg); cursor: pointer;
  color: var(--text-secondary); font-size: 12px;
  transition: all 0.15s;
}
.theme.on { border-color: var(--accent); color: var(--accent); background: var(--card-bg); }
.theme:hover { border-color: var(--accent); }

/* 主题色选择 */
.color-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}
.color-dot-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.color-dot {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: block;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.12);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.color-dot:hover { transform: scale(1.1); }
.color-dot.on {
  box-shadow: 0 0 0 2px var(--card-bg), 0 0 0 4px var(--accent);
  transform: scale(1.05);
}
.color-dot-wrap.custom input[type='color'] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
.custom-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  border: 1px dashed rgba(255, 255, 255, 0.6);
}
.reset-color {
  margin-top: 10px;
  width: 100%;
  font-size: 12px;
  padding: 8px;
}
.reset-color:disabled { opacity: 0.5; cursor: not-allowed; }

.anim-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
}
.anim-opt {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 12px 6px;
  border: 1px solid var(--glass-border); border-radius: 12px;
  background: var(--input-bg); cursor: pointer;
  color: var(--text-secondary); font-size: 12px;
  transition: all 0.15s;
}
.anim-opt:hover:not(:disabled) { border-color: var(--accent); color: var(--text-primary); }
.anim-opt.on {
  border-color: var(--accent); color: var(--accent);
  background: var(--card-bg); box-shadow: 0 0 0 1px var(--accent) inset;
}
.anim-opt:disabled { opacity: 0.6; cursor: not-allowed; }

.user-info {
  display: flex; flex-direction: column; gap: 4px;
  padding: 12px; background: var(--input-bg); border-radius: 12px; margin-bottom: 10px;
}
.u-name { font-size: 14px; font-weight: 500; }
.u-id { font-size: 11px; color: var(--text-secondary); }
.logout { width: 100%; }

.pwd-form {
  margin-bottom: 10px; padding: 14px;
  border-radius: 12px; background: var(--card-bg);
  border: 1px solid var(--glass-border);
}
.pwd-msg { font-size: 12px; margin: 0 0 8px; }
.pwd-msg.bad { color: #ff6b6b; }
.pwd-msg.good { color: var(--accent); }
.pwd-submit { width: 100%; }

.bg-types { display: flex; flex-direction: column; gap: 8px; }
.bg {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; border-radius: 10px;
  border: 1px solid var(--glass-border);
  background: var(--input-bg); cursor: pointer;
  color: var(--text-secondary); font-size: 13px;
}
.bg.on { border-color: var(--accent); color: var(--accent); background: var(--card-bg); }
.bg:hover { border-color: var(--accent); }

.upload {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-radius: 10px;
  border: 1px dashed var(--glass-border);
  background: var(--input-bg); cursor: pointer;
  color: var(--text-primary); font-size: 13px;
}
.upload:hover { border-color: var(--accent); color: var(--accent); }

.preset { margin-top: 8px; }
.hint { font-size: 11px; color: var(--text-secondary); margin: 6px 0 0; }

.bg-preview {
  width: 100%; height: 120px;
  border-radius: 12px; overflow: hidden;
  background: var(--input-bg);
  display: flex; align-items: center; justify-content: center;
}
.bg-preview img { width: 100%; height: 100%; object-fit: cover; }
.bg-preview .ph { font-size: 12px; color: var(--text-secondary); }
.apply { margin-top: 10px; width: 100%; }

/* 动效开关 */
.anim-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; border-radius: 10px;
  background: var(--input-bg); border: 1px solid var(--glass-border);
}
.anim-info { display: flex; flex-direction: column; gap: 2px; }
.anim-title { font-size: 13px; color: var(--text-primary); }
.anim-desc { font-size: 11px; color: var(--text-secondary); }
.switch {
  position: relative; width: 38px; height: 22px; flex-shrink: 0;
  border: none; border-radius: 999px; cursor: pointer;
  background: var(--glass-border);
  transition: background 0.2s ease;
}
.switch .knob {
  position: absolute; top: 2px; left: 2px;
  width: 18px; height: 18px; border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
  transition: transform 0.2s ease;
}
.switch.on { background: var(--accent); }
.switch.on .knob { transform: translateX(16px); }
.switch:disabled { cursor: not-allowed; opacity: 0.6; }

.add-btn {
  width: 24px; height: 24px; border-radius: 50%;
  border: none; background: var(--accent); color: #fff;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.engine-list { display: flex; flex-direction: column; gap: 6px; }
.engine-row {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; border-radius: 10px;
  background: var(--input-bg); font-size: 13px;
}
.engine-row.default { border: 1px solid var(--accent); }
.e-icon { font-size: 14px; }
.e-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge {
  background: var(--accent); color: #fff;
  padding: 2px 6px; border-radius: 4px; font-size: 10px;
}
.mini-btn {
  border: none; background: transparent; cursor: pointer;
  color: var(--text-secondary); padding: 4px;
  border-radius: 6px; font-size: 11px;
  display: flex; align-items: center; justify-content: center;
}
.mini-btn:hover { background: var(--card-bg); color: var(--text-primary); }
.mini-btn.danger:hover { color: #ff6b6b; }

.engine-form {
  margin-top: 16px; padding: 14px;
  border-radius: 12px; background: var(--card-bg);
  border: 1px solid var(--glass-border);
}
.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.field > span { font-size: 11px; color: var(--text-secondary); }
.field.check { flex-direction: row; align-items: center; gap: 6px; }
.actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }

/* 透明度滑块 */
.slider-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; border-radius: 10px;
  background: var(--input-bg); border: 1px solid var(--glass-border);
}
.opacity-range {
  flex: 1; -webkit-appearance: none; appearance: none;
  height: 6px; border-radius: 999px;
  background: var(--glass-border);
  outline: none; cursor: pointer;
}
.opacity-range::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--accent); cursor: pointer;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.25);
}
.opacity-range::-moz-range-thumb {
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--accent); cursor: pointer; border: 2px solid #fff;
}
.slider-val {
  min-width: 42px; text-align: right;
  font-size: 12px; color: var(--text-secondary); font-variant-numeric: tabular-nums;
}
</style>
