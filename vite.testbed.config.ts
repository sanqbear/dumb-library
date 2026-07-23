import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

/**
 * Browser testbed — runs the renderer as a plain Vue app so the UI can be
 * reviewed and screenshotted without building or launching Electron.
 *
 * `index.testbed.html` is the shell (window-size chrome); it embeds
 * `app.testbed.html` in an iframe so the app gets its own document, and
 * naive-ui's teleported modals/drawers land inside the simulated window
 * rather than over the shell.
 *
 * Run with `npm run testbed`.
 */
export default defineConfig({
  root: '.',
  // Placeholder cover art lives outside `public/` so it never ships in the
  // Electron build; served here at /lib/, mirroring the wl-image://lib/ scheme.
  publicDir: 'testbed-assets',
  plugins: [vue()],
  server: {
    port: 5180,
    open: '/index.testbed.html'
  },
  build: {
    outDir: 'out/testbed',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        shell: resolve(__dirname, 'index.testbed.html'),
        app: resolve(__dirname, 'app.testbed.html')
      }
    }
  }
})
