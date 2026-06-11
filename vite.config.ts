const sourceMappingUrlCommentPattern = /\n?\/\/# sourceMappingURL=.*\.js\.map\s*$/u

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { DEV_SERVER_START_PORT, resolveDevServerListenHost } from './shared/dev-server'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

const howcodeAliasEntries = [
  ['@howcode/app-menu', 'src/app/app-menu'],
  ['@howcode/app-shell', 'src/app/app-shell'],
  ['@howcode/archive', 'src/app/archive'],
  ['@howcode/native-artifacts', 'src/app/native/artifact-shell'],
  ['@howcode/chat-workspace', 'src/app/chat-workspace'],
  ['@howcode/code-workspace', 'src/app/code-workspace'],
  ['@howcode/common', 'src/app/common'],
  ['@howcode/composer', 'src/app/composer'],
  ['@howcode/desktop', 'src/app/desktop'],
  ['@howcode/native-gitops', 'src/app/native/gitops'],
  ['@howcode/native-markdown-artifacts', 'src/app/native/markdown-artifacts'],
  ['@howcode/native-interactive-artifacts', 'src/app/native/interactive-artifacts'],
  ['@howcode/extensions', 'src/app/extensions'],
  ['@howcode/inbox', 'src/app/inbox'],
  ['@howcode/query', 'src/app/query'],
  ['@howcode/roadmaps', 'src/app/roadmaps'],
  ['@howcode/projects', 'src/app/projects'],
  ['@howcode/settings', 'src/app/settings/settings'],
  ['@howcode/sessions', 'src/app/sessions'],
  ['@howcode/sidebar', 'src/app/components/sidebar'],
  ['@howcode/skills', 'src/app/skills'],
  ['@howcode/state', 'src/app/state'],
  ['@howcode/native-terminal', 'src/app/native/terminal'],
  ['@howcode/thread', 'src/app/thread'],
  ['@howcode/ui', 'src/app/ui'],
  ['@howcode/workspace-shell', 'src/app/workspace-shell'],
] as const

const howcodeAliases = [
  ...howcodeAliasEntries.map(([alias, target]) => ({
    find: new RegExp(`^${alias.replace('/', '\\/')}/(.+)$`, 'u'),
    replacement: path.resolve(projectRoot, target, '$1'),
  })),
  { find: /^@howcode\/shared\/(.+)$/u, replacement: path.resolve(projectRoot, 'shared', '$1') },
  ...howcodeAliasEntries.map(([alias, target]) => ({
    find: alias,
    replacement: path.resolve(projectRoot, target, 'index.ts'),
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
  base: './',
  assetsInclude: ['**/*.wasm'],
  resolve: {
    alias: howcodeAliases,
  },
  optimizeDeps: {
    exclude: ['@wterm/ghostty'],
    include: [
      'prismjs',
      'prismjs/components/prism-c',
      'prismjs/components/prism-clike',
      'prismjs/components/prism-cpp',
      'prismjs/components/prism-css',
      'prismjs/components/prism-java',
      'prismjs/components/prism-javascript',
      'prismjs/components/prism-markdown',
      'prismjs/components/prism-markup',
      'prismjs/components/prism-objectivec',
      'prismjs/components/prism-powershell',
      'prismjs/components/prism-python',
      'prismjs/components/prism-rust',
      'prismjs/components/prism-sql',
      'prismjs/components/prism-swift',
      'prismjs/components/prism-typescript',
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
    host: resolveDevServerListenHost(),
    port: DEV_SERVER_START_PORT,
    strictPort: false,
    watch: {
      ignored: ['**/.worktrees/**'],
    },
  },
})
