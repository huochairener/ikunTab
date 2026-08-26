import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api'
import type { User } from '@/types'

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const loaded = ref(false)

  async function init() {
    try {
      user.value = await api.me()
    } catch {
      user.value = null
    } finally {
      loaded.value = true
    }
  }

  async function login(username: string, password: string) {
    user.value = await api.login({ username, password })
  }

  async function register(username: string, password: string, email?: string) {
    user.value = await api.register({ username, password, email })
  }

  async function logout() {
    await api.logout()
    user.value = null
  }

  return { user, loaded, init, login, register, logout }
})
