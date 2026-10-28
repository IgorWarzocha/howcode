import { spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'howcode-release-'))
const buildRoot = path.join(stagingRoot, 'build')
const rendererRoot = path.join(stagingRoot, 'dist')
const channel = process.argv[2] ?? 'main'
const version = process.argv[3]

function run(args: string[]) {
  const result = spawnSync(process.execPath, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      HOWCODE_BUILD_ROOT: buildRoot,
      HOWCODE_RENDERER_ROOT: rendererRoot,
    },
  })
  if (result.status !== 0) throw new Error(`Release preparation failed: bun ${args.join(' ')}`)
}

try {
  run(['./scripts/pack-howcode.ts', channel, 'preflight', ...(version ? [version] : [])])
  run(['run', 'generate:components'])
  run(['run', 'vite', 'build', '--configLoader', 'runner', '--outDir', rendererRoot])
  run(['./scripts/build-runtime.ts'])
  run(['./scripts/pack-howcode.ts', channel, 'pack', ...(version ? [version] : [])])
} finally {
  await rm(stagingRoot, { recursive: true, force: true })
}
