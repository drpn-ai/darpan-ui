import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/rpc/json': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/qapps/darpan/rpc/json': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/apps/darpan/csrfToken': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html']
    }
  }
})
