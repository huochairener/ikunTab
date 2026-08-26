<script setup lang="ts">
import { computed, ref } from 'vue'
import { X, ExternalLink } from 'lucide-vue-next'
import type { Widget } from '@/types'
import type { CustomWidgetConfig } from '@/types'

const props = defineProps<{ widget: Widget }>()
const cfg = computed<CustomWidgetConfig>(() => {
  try {
    return JSON.parse(props.widget.config || '{}')
  } catch {
    return { outerUrl: '', clickBehavior: 'iframe' }
  }
})

const popupOpen = ref(false)
/* 供 WidgetGrid 在 widget-actions 中触发 */
function openPopup() {
  if (cfg.value.clickBehavior === 'popup') popupOpen.value = true
}
defineExpose({ openPopup })
</script>

<template>
  <div class="cw">
    <header class="cw-head" v-if="widget.name">
      <span>{{ widget.name }}</span>
    </header>
    <div class="cw-body">
      <iframe
        v-if="cfg.clickBehavior !== 'none'"
        :src="cfg.outerUrl"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        loading="lazy"
        referrerpolicy="no-referrer"
      ></iframe>
      <div v-else class="placeholder">
        <ExternalLink :size="22" />
        <p>未启用内容</p>
      </div>
    </div>

    <!-- 弹窗 -->
    <teleport to="body">
      <div v-if="popupOpen" class="popup-mask" @click.self="popupOpen = false">
        <div class="popup glass">
          <header>
            <span>{{ widget.name || '内容' }}</span>
            <button @click="popupOpen = false"><X :size="18" /></button>
          </header>
          <iframe
            :src="cfg.popupUrl || cfg.outerUrl"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            loading="lazy"
            referrerpolicy="no-referrer"
          ></iframe>
        </div>
      </div>
    </teleport>
  </div>
</template>

<style scoped>
.cw { display: flex; flex-direction: column; height: 100%; }
.cw-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px;
  font-size: 13px; font-weight: 500;
  border-bottom: 1px solid var(--glass-border);
}
.ext {
  border: none; background: transparent; color: var(--text-secondary);
  cursor: pointer; padding: 4px; border-radius: 6px;
}
.ext:hover { background: var(--input-bg); }
.cw-body { flex: 1; position: relative; overflow: hidden; }
.cw-body iframe {
  width: 100%; height: 100%; border: none;
}
.placeholder {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; height: 100%;
  color: var(--text-secondary); cursor: pointer;
}
.placeholder p { font-size: 12px; margin: 0; }

.popup-mask {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center;
}
.popup {
  width: min(900px, 90vw); height: min(640px, 86vh);
  border-radius: 16px; overflow: hidden;
  display: flex; flex-direction: column;
}
.popup header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-bottom: 1px solid var(--glass-border);
  font-size: 14px; font-weight: 500;
}
.popup header button {
  border: none; background: transparent; cursor: pointer;
  color: var(--text-secondary); padding: 4px; border-radius: 6px;
}
.popup header button:hover { background: var(--input-bg); }
.popup iframe { flex: 1; border: none; width: 100%; }
</style>
