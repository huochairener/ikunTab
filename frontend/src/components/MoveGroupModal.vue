<script setup lang="ts">
import { computed, ref } from 'vue'
import { X, Check } from 'lucide-vue-next'
import type { Bookmark } from '@/types'
import { useAppStore } from '@/store/app'
import { api } from '@/api'

const props = defineProps<{
  folder: Bookmark
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'moved', targetGroupId: number): void
}>()

const app = useAppStore()

/** 可选目标分组：排除文件夹当前所在分组 */
const candidates = computed(() =>
  app.groups.filter((g) => g.id !== props.folder.groupId),
)

/** 文件夹内的直接子项数量（用于确认文案提示） */
const childCount = computed(
  () => app.bookmarks.filter((b) => b.parentId === props.folder.id).length,
)

const selectedId = ref<number | null>(null)
const moving = ref(false)
const err = ref('')

async function confirm() {
  if (selectedId.value === null || moving.value) return
  moving.value = true
  err.value = ''
  try {
    await api.moveBookmark({
      id: props.folder.id,
      groupId: selectedId.value,
      parentId: null, // 落到目标分组顶层；sortOrder 不传，后端自动追加到末尾
    })
    emit('moved', selectedId.value)
  } catch (e: any) {
    err.value = e?.message || '移动失败，请重试'
    moving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-mask" @click.self="emit('close')">
      <div class="modal glass">
        <header>
          <h3>移动分组</h3>
          <button class="x" @click="emit('close')"><X :size="18" /></button>
        </header>

        <p class="desc">
          将文件夹「{{ folder.name }}」<template v-if="childCount">（含 {{ childCount }} 个项目）</template>移动到：
        </p>

        <div class="group-list">
          <button
            v-for="g in candidates"
            :key="g.id"
            class="group-item"
            :class="{ on: selectedId === g.id }"
            @click="selectedId = g.id"
          >
            <span class="g-icon">{{ g.icon || g.name.charAt(0) }}</span>
            <span class="g-name">{{ g.name }}</span>
            <Check v-if="selectedId === g.id" :size="15" class="g-check" />
          </button>
          <p v-if="!candidates.length" class="empty-tip">没有其他分组可移动</p>
        </div>

        <footer>
          <p v-if="err" class="err">{{ err }}</p>
          <div class="actions">
            <button class="btn btn-ghost" @click="emit('close')">取消</button>
            <button
              class="btn btn-primary"
              :disabled="selectedId === null || moving"
              @click="confirm"
            >
              {{ moving ? '移动中…' : '移动' }}
            </button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-mask {
  position: fixed; inset: 0; z-index: 90;
  background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(2px);
}
.modal {
  width: min(420px, 92vw);
  border-radius: 18px; padding: 22px 22px 18px;
}
header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px;
}
header h3 { font-size: 17px; margin: 0; font-weight: 600; }
.x {
  border: none; background: transparent; color: var(--text-secondary);
  cursor: pointer; padding: 4px; border-radius: 8px;
}
.x:hover { background: var(--input-bg); }

.desc { font-size: 13px; color: var(--text-secondary); margin: 0 0 14px; }

.group-list {
  display: flex; flex-direction: column; gap: 8px;
  max-height: 40vh; overflow-y: auto;
  margin-bottom: 6px;
}
.group-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 12px;
  border: 1px solid var(--glass-border);
  background: var(--input-bg); color: var(--text-primary);
  cursor: pointer; font-size: 13px; text-align: left;
  transition: border-color 0.15s, background 0.15s;
}
.group-item:hover { border-color: var(--accent); }
.group-item.on {
  border-color: var(--accent);
  background: rgba(99, 102, 241, 0.1);
}
.g-icon { font-size: 16px; line-height: 1; }
.g-name { flex: 1; font-weight: 500; }
.g-check { color: var(--accent); flex-shrink: 0; }
.empty-tip { font-size: 13px; color: var(--text-secondary); text-align: center; padding: 18px 0; margin: 0; }

footer {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 14px;
}
.err { color: #ff6b6b; font-size: 12px; margin: 0; }
.actions { display: flex; gap: 8px; }
.actions .btn[disabled] { opacity: 0.5; cursor: not-allowed; }
</style>
