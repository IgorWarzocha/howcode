import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'pages',
  base: '/howcode/',
  build: {
    outDir: '../dist-pages',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        dependencies: resolve(__dirname, 'dependencies/index.html'),
        index: resolve(__dirname, 'index.html'),
      },
    },
  },
  plugins: [react()],
})
