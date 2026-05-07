const sourceMappingUrlCommentPattern = /\n?\/\/# sourceMappingURL=.*\.js\.map\s*$/u

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

function stripGhosttyPackageSourcemaps(): Plugin {
  return {
    name: 'strip-ghostty-package-sourcemaps',
    enforce: 'pre',
    transform(code, id) {
      if (!(id.includes('/node_modules/@wterm/ghostty/dist/') && id.endsWith('.js'))) {
        return null
      }

      return {
        code: code.replace(sourceMappingUrlCommentPattern, ''),
        map: null,
      }
    },
  }
}

export default defineConfig({
  base: './',
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['@wterm/ghostty'],
  },
  build: {
    chunkSizeWarningLimit: 1300,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /node_modules[/](?:react|react-dom|scheduler)[/]/,
              priority: 30,
            },
            {
              name: 'vendor-terminal',
              test: /node_modules[/]@wterm[/]/,
              priority: 20,
            },
            {
              name: 'vendor-ui',
              test: /node_modules[/](?:@dnd-kit|@tanstack|lucide-react|react-grab)[/]/,
              priority: 10,
            },
            {
              name: 'vendor-pi',
              test: /node_modules[/](?:@earendil-works|@mariozechner)[/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  plugins: [stripGhosttyPackageSourcemaps(), react(), tailwindcss()],
  worker: {
    format: 'es',
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
  },
})
