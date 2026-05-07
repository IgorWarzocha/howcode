import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'pages',
  base: '/howcode/',
  build: {
    outDir: '../dist-pages',
    emptyOutDir: true,
  },
  plugins: [react()],
})
