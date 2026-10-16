const sourceMappingUrlCommentPattern = /\n?\/\/# sourceMappingURL=.*\.js\.map\s*$/u

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import packageMetadata from './package.json'
import { DEV_SERVER_START_PORT, resolveDevServerListenHost } from './shared/dev-server'

const directoryRoot = fileURLToPath(new URL('.', import.meta.url))
const localPackageNames = Object.entries(packageMetadata.dependencies)
  .filter(([, version]) => version.startsWith('file:'))
  .map(([name]) => name)

const howcodeAliasEntries = [
  ['@howcode/app-menu', 'src/app/app-menu'],
  ['@howcode/app-shell', 'src/app/app-shell'],
  ['@howcode/archive', 'src/app/archive'],
  ['@howcode/chat-workspace', 'src/app/chat-workspace'],
  ['@howcode/common', 'src/app/common'],
  ['@howcode/desktop', 'src/app/desktop'],
  ['@howcode/component-system', 'src/app/component-system'],
  ['@howcode/inbox', 'src/app/inbox'],
  ['@howcode/git-integration', 'src/app/git-integration'],
  ['@howcode/query', 'src/app/query'],
  ['@howcode/settings', 'src/app/settings/settings'],
  ['@howcode/sessions', 'src/app/sessions'],
  ['@howcode/state', 'src/app/state'],
  ['@howcode/ui', 'src/app/ui'],
  ['@howcode/workspace-shell', 'src/app/workspace-shell'],
] as const

const howcodeAliases = [
  {
    find: /^@howcode\/components\/(.+)$/u,
    replacement: path.resolve(directoryRoot, 'components', '$1'),
  },
  ...howcodeAliasEntries.map(([alias, target]) => ({
    find: new RegExp(`^${alias.replace('/', '\\/')}/(.+)$`, 'u'),
    replacement: path.resolve(directoryRoot, target, '$1'),
  })),
  { find: /^@howcode\/shared\/(.+)$/u, replacement: path.resolve(directoryRoot, 'shared', '$1') },
  ...howcodeAliasEntries.map(([alias, target]) => ({
    find: alias,
    replacement: path.resolve(directoryRoot, target, 'index.ts'),
  })),
] as const

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
  base: '/',
  assetsInclude: ['**/*.wasm'],
  resolve: {
    alias: howcodeAliases,
  },
  optimizeDeps: {
    // Excluded local SDK sources still need their Markdown dependency's CommonJS interop.
    include: ['@howaboua/howcode-sdk > react-markdown'],
    // Plugin assets/workers and local same-version packages need Vite's transform pipeline.
    exclude: [
      ...new Set(['@wterm/ghostty', ...packageMetadata.howcodeComponents, ...localPackageNames]),
    ],
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
              test: /node_modules[/](?:@dnd-kit|@tanstack|lucide-react)[/]/,
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
    host: resolveDevServerListenHost(),
    port: DEV_SERVER_START_PORT,
    strictPort: false,
    watch: {
      ignored: ['**/.worktrees/**'],
    },
  },
})
