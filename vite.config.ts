import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

// Perf 2026-07-02: warm the TCP+TLS connection to the API origin while the app bundle is still
// parsing, so the first RPC does not pay DNS + connection setup. The origin is baked at build time
// from VITE_DARPAN_API_BASE_URL; dev/test runs (same-origin proxy, no env value) inject nothing.
function apiPreconnectPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'darpan-api-preconnect',
    transformIndexHtml() {
      let origin: string
      try {
        origin = new URL(env.VITE_DARPAN_API_BASE_URL ?? '').origin
      } catch {
        return
      }
      // fetch() partitions connections by credentials mode: cookie-auth mode sends credentialed
      // requests, header-auth mode sends anonymous ones. Warm the pool the client will use.
      const crossorigin = env.VITE_DARPAN_COOKIE_AUTH === 'true' ? 'use-credentials' : 'anonymous'
      return [
        {
          tag: 'link',
          attrs: { rel: 'preconnect', href: origin, crossorigin },
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue(), apiPreconnectPlugin(env)],
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
      port: 4173,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        // Ratchet floor, not a target: actuals on 2026-07-02 were lines/statements 90.66%,
        // functions 82.8%, branches 73.8%. Set ~2 points below actuals so `npm run test`
        // fails on a material coverage drop. Raise these as real coverage rises.
        thresholds: {
          lines: 88.5,
          statements: 88.5,
          functions: 80.5,
          branches: 71.5,
        },
      },
    },
  }
})
