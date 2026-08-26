import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8090', changeOrigin: true },
      '/uploads': { target: 'http://localhost:8090', changeOrigin: true },
    },
  },
  build: {
    // 构建产物为 dist/，由 Python FastAPI 后端从 ./static 托管
    // （Docker 多阶段构建时由 frontend-builder 阶段拷贝至 backend-py/static）
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
})
