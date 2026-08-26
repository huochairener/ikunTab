import axios from 'axios'

export const http = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 15000,
})

// 响应拦截：解包 R<T>，code!=0 抛错
http.interceptors.response.use(
  (resp) => {
    const body = resp.data
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 0) return { ...resp, data: body.data }
      const err: any = new Error(body.msg || '请求失败')
      err.code = body.code
      if (body.code === 401) {
        // 未登录：跳登录页（避免在登录页本身循环）
        if (!location.pathname.startsWith('/login')) {
          location.href = '/login'
        }
      }
      return Promise.reject(err)
    }
    return resp
  },
  (error) => {
    const status = error.response?.status
    if (status === 401 && !location.pathname.startsWith('/login')) {
      location.href = '/login'
    }
    return Promise.reject(error)
  },
)
