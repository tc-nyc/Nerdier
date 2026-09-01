import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Where the site will be served from.
 *
 * Defaults to the domain root, which is what Azure Static Web Apps and
 * `npm run dev` want. Set BASE_PATH when serving from a subfolder — e.g. a
 * Synology Web Station site reached at `http://nas/nerdier/`:
 *
 *     BASE_PATH=/nerdier/ npm run build
 *
 * Built asset URLs are absolute, so getting this wrong means every script and
 * stylesheet 404s while index.html still loads — a blank page with console
 * errors, not an obvious failure. Trailing slash is enforced below because
 * Vite requires it and omitting it silently mangles the paths.
 */
const rawBase = process.env['BASE_PATH'] ?? '/'
const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Emit an external registration script rather than an inline one: the
      // Content-Security-Policy in staticwebapp.config.json has no 'unsafe-inline'
      // for script-src, so an inline registration would be blocked in production.
      injectRegister: 'script-defer',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Nerdier',
        short_name: 'Nerdier',
        description: 'Six tries to find the hidden eight-character equation.',
        theme_color: '#1b1b1f',
        background_color: '#1b1b1f',
        display: 'standalone',
        orientation: 'portrait',
        // These must track `base`. A manifest whose scope does not cover the page
        // makes the app silently non-installable.
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The whole game is static and offline-capable; there is no API to cache.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    // Logic tests run in plain node; files needing a DOM opt in per-file with
    // a `@vitest-environment jsdom` docblock.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
