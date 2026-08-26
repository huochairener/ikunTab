import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/pages/HomePage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/login', name: 'login', component: () => import('@/pages/LoginPage.vue') },
    { path: '/register', name: 'register', component: () => import('@/pages/RegisterPage.vue') },
  ],
})

router.beforeEach(async (to, _from, next) => {
  // 简单守卫：未登录访问首页 -> 登录页；已登录访问登录/注册 -> 首页
  const { useUserStore } = await import('@/store/user')
  const u = useUserStore()
  if (!u.loaded) await u.init()
  if (to.name !== 'login' && to.name !== 'register' && !u.user) {
    next({ name: 'login' })
  } else if ((to.name === 'login' || to.name === 'register') && u.user) {
    next({ name: 'home' })
  } else {
    next()
  }
})

export default router
