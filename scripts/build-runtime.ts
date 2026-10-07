import { cp, mkdir, rm, watch } from 'node:fs/promises'
import path from 'node:path'

const isWatchMode = process.argv.includes('--watch')
const projectRoot = process.cwd()
const buildRoot = path.resolve(
  getEnvironmentVariable('HOWCODE_BUILD_ROOT') || path.join(projectRoot, 'build'),
)

function getEnvironmentVariable(name: string) {
  return process.env[name]
}
const buildLifetime = new AbortController()
let shutdownRequested = false

const buildTargets = [
  {
    label: 'server-runtime',
    entrypoints: [path.join(projectRoot, 'src', 'server', 'index.ts')],
    outdir: path.join(buildRoot, 'server'),
    root: path.join(projectRoot, 'src', 'server'),
    naming: { entry: '[name].mjs' },
    format: 'esm',
  },
  {
    label: 'desktop-runtime',
    entrypoints: [
      path.join(projectRoot, 'desktop', 'pi-threads.ts'),
      path.join(projectRoot, 'desktop', 'pi-skills.ts'),
      path.join(projectRoot, 'desktop', 'service-host.ts'),
      path.join(projectRoot, 'desktop', 'service-host-runtime.ts'),
    ],
    outdir: path.join(buildRoot, 'desktop'),
    root: path.join(projectRoot, 'desktop'),
    naming: {
      entry: '[name].mjs',
    },
    format: 'esm',
  },
  {
    label: 'terminal-manager',
    entrypoints: [path.join(projectRoot, 'desktop', 'terminal', 'runtime.ts')],
    outdir: path.join(buildRoot, 'desktop'),
    root: path.join(projectRoot, 'desktop', 'terminal'),
    naming: {
      entry: 'terminal-manager.mjs',
    },
    format: 'esm',
  },
] as const

async function prepareBuildDirectories() {
  await rm(path.join(buildRoot, 'server'), { recursive: true, force: true })
  await rm(path.join(buildRoot, 'desktop'), { recursive: true, force: true })
  await mkdir(path.join(buildRoot, 'server'), { recursive: true })
  await mkdir(path.join(buildRoot, 'desktop'), { recursive: true })
}

async function copyDesktopResources() {
  const outputPath = path.join(buildRoot, 'resources')
  await rm(outputPath, { recursive: true, force: true })
  await cp(path.join(projectRoot, 'desktop', 'resources'), outputPath, {
    recursive: true,
  })
}

async function buildTarget(target: (typeof buildTargets)[number]) {
  // Source watching is supported by Bun's CLI, not the Bun.build API.
  const child = Bun.spawn(
    [
      process.execPath,
      'build',
      ...target.entrypoints,
      '--target=node',
      `--format=${target.format}`,
      '--packages=external',
      '--sourcemap=linked',
      `--outdir=${target.outdir}`,
      `--root=${target.root}`,
      `--entry-naming=${target.naming.entry}`,
      ...(isWatchMode ? ['--watch', '--no-clear-screen'] : []),
    ],
    { cwd: projectRoot, stdio: ['ignore', 'inherit', 'inherit'], signal: buildLifetime.signal },
  )
  const exitCode = await child.exited
  if (buildLifetime.signal.aborted) return
  if (exitCode !== 0 || isWatchMode) {
    throw new Error(`${target.label} ${isWatchMode ? 'watcher' : 'build'} exited with ${exitCode}.`)
  }
  console.log(`Built ${target.label}.`)
}

async function watchDesktopResources() {
  for await (const _event of watch(path.join(projectRoot, 'desktop', 'resources'), {
    recursive: true,
    signal: buildLifetime.signal,
  })) {
    await copyDesktopResources()
    console.log('Copied desktop resources.')
  }
}

async function runBuild() {
  await prepareBuildDirectories()
  await copyDesktopResources()
  if (buildLifetime.signal.aborted) return

  const tasks = buildTargets.map(buildTarget)
  if (isWatchMode) {
    tasks.push(watchDesktopResources())
    console.log('Watching Node runtime bundles...')
  }
  try {
    await Promise.all(tasks)
  } finally {
    buildLifetime.abort()
    await Promise.allSettled(tasks)
  }
}

function shutdown() {
  shutdownRequested = true
  buildLifetime.abort()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

void runBuild().catch((error) => {
  if (!shutdownRequested) {
    console.error(error)
    process.exitCode = 1
  }
})
