import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    /*
     * Fail rather than drift. Vite's default is to pick the next free port, but the
     * backend's CORS allowlist names this exact origin — a silent move to 5175 would
     * present as an unexplained CORS failure. Better to say the port is taken.
     */
    strictPort: true,
    /*
     * Hosts allowed to reach the dev server through a reverse proxy.
     *
     * Vite rejects requests whose Host header it does not recognise, which is what
     * a Cloudflare quick tunnel presents. `.trycloudflare.com` covers the tunnel's
     * hostname and any new one a restart hands out.
     */
    allowedHosts: ['.trycloudflare.com'],
    /*
     * A same-origin fallback for /api.
     *
     * Only used when `VITE_API_BASE_URL` is empty, which makes every request
     * relative and routes it through here — useful when the API has no CORS
     * policy for this origin, or to mirror a production deployment that serves
     * both behind one host.
     *
     * With `VITE_API_BASE_URL` set (the default now), the browser talks to the
     * API directly and this proxy is simply not exercised.
     */
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET ?? 'http://localhost:5030',
        changeOrigin: true,
        // Allows a self-signed dev certificate when the target is https.
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split the heaviest third-party code out of the entry chunk so the login
        // screen does not pay for charting and QR rendering it never uses.
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia', 'vue-i18n', 'axios'],
          qr: ['qrcode'],
        },
      },
    },
  },
})
