const sourceMappingUrlCommentPattern = /\n?\/\/# sourceMappingURL=.*\.js\.map\s*$/u

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

const howcodeAliases = {
  '@howcode/app-menu': path.resolve(projectRoot, 'src/app/app-menu/index.ts'),
  '@howcode/common': path.resolve(projectRoot, 'src/app/components/common/index.ts'),
  '@howcode/composer': path.resolve(projectRoot, 'src/app/components/workspace/composer/index.ts'),
  '@howcode/desktop': path.resolve(projectRoot, 'src/app/desktop/index.ts'),
  '@howcode/native-gitops/diff-panel': path.resolve(
    projectRoot,
    'src/app/native/gitops/diff-panel.tsx',
  ),
  '@howcode/native-gitops': path.resolve(projectRoot, 'src/app/native/gitops/index.ts'),
  '@howcode/extensions': path.resolve(projectRoot, 'src/app/features/extensions/index.ts'),
  '@howcode/query': path.resolve(projectRoot, 'src/app/query/index.ts'),
  '@howcode/settings': path.resolve(projectRoot, 'src/app/views/settings/index.ts'),
  '@howcode/shared': path.resolve(projectRoot, 'shared'),
  '@howcode/sidebar': path.resolve(projectRoot, 'src/app/components/sidebar/index.ts'),
  '@howcode/skills': path.resolve(projectRoot, 'src/app/features/skills/index.ts'),
  '@howcode/state': path.resolve(projectRoot, 'src/app/state/index.ts'),
  '@howcode/native-terminal': path.resolve(projectRoot, 'src/app/native/terminal/index.ts'),
  '@howcode/thread': path.resolve(projectRoot, 'src/app/components/workspace/thread/index.ts'),
  '@howcode/ui': path.resolve(projectRoot, 'src/app/ui/index.ts'),
  '@howcode/workspace': path.resolve(projectRoot, 'src/app/components/workspace/index.ts'),
} as const

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
  resolve: {
    alias: howcodeAliases,
  },
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
              test: /node_modules[/]@earendil-works[/]/,
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
