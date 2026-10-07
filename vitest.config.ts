import { mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, {
  test: {
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'desktop/**/*.test.ts',
      'components/**/*.test.ts',
      'components/**/*.test.tsx',
      'packages/howcode/test/**/*.test.ts',
      'workers/polls/src/**/*.test.ts',
    ],
    exclude: ['node_modules/**', 'dist/**', 'build/**', 'Frameworks/**'],
  },
})
