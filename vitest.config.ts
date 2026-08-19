import { mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, {
  test: {
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'desktop/**/*.test.ts',
      'packages/howcode/test/**/*.test.ts',
    ],
    exclude: ['node_modules/**', 'dist/**', 'build/**', 'Frameworks/**'],
  },
})
