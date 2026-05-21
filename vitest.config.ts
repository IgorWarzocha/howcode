import { mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, {
  test: {
    include: ['src/test/**/*.test.ts', 'src/test/**/*.test.tsx'],
    exclude: ['node_modules/**', 'dist/**', 'build/**', 'Frameworks/**'],
  },
})
