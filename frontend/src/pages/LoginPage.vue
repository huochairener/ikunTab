<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { useAppStore } from '@/store/app'

const router = useRouter()
const user = useUserStore()
const app = useAppStore()

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await user.login(username.value, password.value)
    await app.loadAll()
    router.push('/')
  } catch (e: any) {
    error.value = e.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-wrap">
    <div class="blob blob1"></div>
    <div class="blob blob2"></div>
    <form class="auth-card glass" @submit.prevent="onSubmit">
      <div class="brand">
        <span class="logo">🪐</span>
        <div>
          <h1>ikuntab</h1>
          <p>你的专属浏览器首页</p>
        </div>
      </div>
      <label class="field">
        <span>用户名</span>
        <input class="input" v-model="username" placeholder="用户名" autocomplete="username" />
      </label>
      <label class="field">
        <span>密码</span>
        <input class="input" type="password" v-model="password" placeholder="密码" autocomplete="current-password" />
      </label>
      <p v-if="error" class="err">{{ error }}</p>
      <button class="btn btn-primary w-full" :disabled="loading">
        {{ loading ? '登录中…' : '登 录' }}
      </button>
      <p class="switch">
        还没有账号？<router-link to="/register">立即注册</router-link>
      </p>
    </form>
  </div>
</template>

<style scoped>
.auth-wrap {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(1200px 600px at 20% 10%, var(--bg-grad-1), transparent 60%),
    radial-gradient(1000px 700px at 90% 90%, var(--bg-grad-2), transparent 55%), var(--bg-base);
  overflow: hidden;
}
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  opacity: 0.5;
}
.blob1 { width: 360px; height: 360px; background: var(--accent); top: -80px; left: -60px; }
.blob2 { width: 420px; height: 420px; background: var(--accent-2); bottom: -120px; right: -80px; }
.auth-card {
  position: relative;
  width: 360px;
  padding: 32px 28px;
  border-radius: 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  z-index: 1;
}
.brand { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
.brand .logo { font-size: 34px; }
.brand h1 { margin: 0; font-size: 22px; font-family: var(--font-display); }
.brand p { margin: 2px 0 0; font-size: 12px; color: var(--text-secondary); }
.field { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--text-secondary); }
.w-full { width: 100%; }
.switch { font-size: 13px; text-align: center; color: var(--text-secondary); margin-top: 4px; }
.switch a { color: var(--accent); text-decoration: none; }
.err { color: #ff5c5c; font-size: 13px; margin: 0; }
</style>
