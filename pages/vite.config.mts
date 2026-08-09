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
        blog: resolve(import.meta.dirname, 'blog/index.html'),
        blogWorktrees: resolve(import.meta.dirname, 'blog/worktrees/index.html'),
        dependencies: resolve(import.meta.dirname, 'dependencies/index.html'),
        index: resolve(import.meta.dirname, 'index.html'),
      },
    },
  },
  plugins: [react()],
})
