<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { X, Upload, Loader2 } from 'lucide-vue-next'
import type { Bookmark } from '@/types'
import { api } from '@/api'
import { domainOf } from '@/utils/bookmark'

const props = defineProps<{
  bm: Bookmark | null
  groupId: number
  parentId?: number | null
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
}>()

const name = ref('')
const url = ref('')
const type = ref(0)               // 0 书签 1 文件夹（编辑时取自原值）
const iconType = ref<Bookmark['iconType']>('favicon')
const iconValue = ref('')
const loading = ref(false)
const fetchingIcon = ref(false)
const err = ref('')
const previewSrc = ref<string | null>(null)

const isEdit = computed(() => !!props.bm)
const isFolder = computed(() => type.value === 1)

onMounted(() => {
  if (props.bm) {
    name.value = props.bm.name
    url.value = props.bm.url || ''
    type.value = props.bm.type ?? 0
    iconType.value = props.bm.iconType
    iconValue.value = props.bm.iconValue || ''
  }
  refreshPreview()
})

watch([iconType, iconValue, url], refreshPreview)

function refreshPreview() {
  if (iconType.value === 'favicon') {
    const d = domainOf(url.value)
    previewSrc.value = d ? `https://icon.horse/icon/${d}` : null
  } else if (iconType.value === 'upload') {
    previewSrc.value = iconValue.value || null
  } else if (iconType.value === 'random') {
    if (iconValue.value) {
      const sep = iconValue.value.includes('?') ? '&' : '?'
      previewSrc.value = `${iconValue.value}${sep}t=${Date.now()}`
    } else {
      previewSrc.value = 'https://picsum.photos/64/64?t=' + Date.now()
    }
  } else {
    previewSrc.value = null
  }
}

/** 输入网址后自动尝试抓取 favicon */
async function autoFetchIcon() {
  if (!url.value) return
  fetchingIcon.value = true
  try {
    const finalUrl = await api.favicon(url.value)
    if (finalUrl) {
      iconType.value = 'favicon'
      iconValue.value = ''
      refreshPreview()
    }
  } catch (e) {
    // 抓取失败：保持默认
    console.warn('favicon 抓取失败', e)
  } finally {
    fetchingIcon.value = false
  }
}

async function onUpload(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files || !input.files[0]) return
  loading.value = true
  try {
    const u = await api.upload(input.files[0])
    iconType.value = 'upload'
    iconValue.value = u
    refreshPreview()
  } finally {
    loading.value = false
  }
}

function useRandomPreset() {
  iconType.value = 'random'
  iconValue.value = 'https://picsum.photos/64/64'
  refreshPreview()
}

async function save() {
  err.value = ''
  if (!name.value.trim()) {
    err.value = '请输入名称'
    return
  }
  if (!isFolder.value && iconType.value === 'upload' && !iconValue.value) {
    err.value = '请上传图标'
    return
  }
  if (!isFolder.value && iconType.value === 'random' && !iconValue.value) {
    err.value = '请输入随机图网址'
    return
  }

  // 编辑时保留原 parentId；新增时使用 props.parentId
  const parentId = isEdit.value && props.bm ? props.bm.parentId : (props.parentId ?? null)

  const payload: any = {
    groupId: props.groupId,
    parentId,
    type: type.value,
    name: name.value.trim(),
  }
  if (!isFolder.value) {
    payload.url = url.value.trim() || null
    payload.iconType = iconType.value
    payload.iconValue = iconValue.value || null
  }

  try {
    if (isEdit.value && props.bm) {
      await api.updateBookmark(props.bm.id, payload)
    } else {
      // 新建：放在末尾
      await api.saveBookmark(payload)
    }
    emit('saved')
  } catch (e: any) {
    err.value = e.message || '保存失败'
  }
}
</script>

<template>
  <Teleport to="body">
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal glass">
      <header>
        <h3>{{
          isFolder
            ? (isEdit ? '编辑文件夹' : '新增文件夹')
            : (isEdit ? '编辑书签' : '新增书签')
        }}</h3>
        <button class="x" @click="emit('close')"><X :size="18" /></button>
      </header>

      <div class="form">
        <!-- 预览 -->
        <div class="preview">
          <div class="prev-box">
            <img v-if="previewSrc" :src="previewSrc" alt="" @error="previewSrc = null" />
            <span v-else class="letter">{{ (name || '?').charAt(0).toUpperCase() }}</span>
          </div>
          <div class="prev-meta">
            <p class="prev-tip">实时预览</p>
            <p class="prev-name">{{ name || (isFolder ? '文件夹名称' : '书签名称') }}</p>
          </div>
        </div>

        <label class="field">
          <span>名称</span>
          <input
            v-model="name"
            class="input"
            :placeholder="isFolder ? '例如 常用工具' : '例如 GitHub'"
          />
        </label>

        <template v-if="!isFolder">
          <label class="field">
            <span>网址</span>
            <div class="url-row">
              <input
                v-model="url"
                class="input"
                placeholder="https://github.com"
                @blur="autoFetchIcon"
              />
              <button
                class="btn btn-ghost fetch"
                :disabled="fetchingIcon"
                @click="autoFetchIcon"
              >
                <Loader2 v-if="fetchingIcon" :size="14" class="spin" />
                <span>{{ fetchingIcon ? '抓取中' : '抓取图标' }}</span>
              </button>
            </div>
          </label>

          <div class="field">
            <span>图标来源</span>
            <div class="tabs">
              <button
                v-for="t in ['favicon', 'upload', 'random', 'default'] as const"
                :key="t"
                :class="['tab', iconType === t ? 'on' : '']"
                @click="iconType = t"
              >
                {{ { favicon: '自动', upload: '上传', random: '随机图', default: '默认' }[t] }}
              </button>
            </div>
          </div>

          <div v-if="iconType === 'upload'" class="field">
            <span>上传图标</span>
            <label class="upload">
              <input type="file" accept="image/*" @change="onUpload" hidden />
              <Upload :size="16" />
              <span>{{ loading ? '上传中…' : '选择文件' }}</span>
            </label>
          </div>

          <div v-if="iconType === 'random'" class="field">
            <span>随机图网址</span>
            <input
              v-model="iconValue"
              class="input"
              placeholder="https://picsum.photos/64/64"
            />
            <button class="btn btn-ghost preset" @click="useRandomPreset">
              使用 picsum 预设
            </button>
          </div>
        </template>
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
.modal-mask {
  position: fixed; inset: 0; z-index: 80;
  background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(2px);
}
.modal {
  width: min(560px, 92vw); max-height: 88vh; overflow-y: auto;
  border-radius: 18px; padding: 22px 22px 18px;
}
header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px;
}
header h3 { font-size: 17px; margin: 0; font-weight: 600; }
.x {
  border: none; background: transparent; color: var(--text-secondary);
  cursor: pointer; padding: 4px; border-radius: 8px;
}
.x:hover { background: var(--input-bg); }

.preview {
  display: flex; align-items: center; gap: 14px;
  padding: 12px; background: var(--input-bg); border-radius: 14px;
  margin-bottom: 16px;
}
.prev-box {
  width: 56px; height: 56px; border-radius: 14px; flex-shrink: 0;
  background: var(--card-bg); display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--glass-border); overflow: hidden;
}
.prev-box img { width: 40px; height: 40px; object-fit: contain; border-radius: 8px; }
.letter { font-size: 22px; font-weight: 600; color: var(--accent); }
.prev-tip { font-size: 11px; color: var(--text-secondary); margin: 0; }
.prev-name { font-size: 14px; font-weight: 500; margin: 2px 0 0; }

.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.field > span { font-size: 12px; color: var(--text-secondary); }
.url-row { display: flex; gap: 6px; }
.url-row .input { flex: 1; }
.fetch { white-space: nowrap; }
.tabs { display: flex; gap: 6px; }
.tab {
  flex: 1; padding: 8px; border-radius: 10px; border: 1px solid var(--glass-border);
  background: transparent; color: var(--text-secondary); cursor: pointer; font-size: 12px;
  transition: all 0.15s;
}
.tab.on { background: var(--accent); color: #fff; border-color: var(--accent); }
.upload {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; border-radius: 10px; border: 1px dashed var(--glass-border);
  background: var(--input-bg); color: var(--text-primary); cursor: pointer; font-size: 13px;
}
.upload:hover { border-color: var(--accent); color: var(--accent); }
.preset { margin-top: 6px; align-self: flex-start; }

footer {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 10px;
}
.err { color: #ff6b6b; font-size: 12px; margin: 0; }
.actions { display: flex; gap: 8px; }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
