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
      path.join(projectRoot, 'desktop', 'service-host.ts'),
      path.join(projectRoot, 'desktop', 'service-host-runtime.ts'),
      path.join(projectRoot, 'desktop', 'package-cli.ts'),
    ],
    outdir: path.join(buildRoot, 'desktop'),
    root: path.join(projectRoot, 'desktop'),
    naming: {
      entry: '[name].mjs',
    },
    format: 'esm',
  },
] as const

const resourceTargets = [
  { source: 'desktop/resources/themes', name: 'themes' },
  { source: 'components/skills/resources/skills', name: 'skills' },
] as const

async function prepareBuildDirectories() {
  await rm(path.join(buildRoot, 'server'), { recursive: true, force: true })
  await rm(path.join(buildRoot, 'desktop'), { recursive: true, force: true })
  await rm(path.join(buildRoot, 'resources'), { recursive: true, force: true })
  await mkdir(path.join(buildRoot, 'server'), { recursive: true })
  await mkdir(path.join(buildRoot, 'desktop'), { recursive: true })
}

async function copyResources(target: (typeof resourceTargets)[number]) {
  const outputPath = path.join(buildRoot, 'resources', target.name)
  await rm(outputPath, { recursive: true, force: true })
  await cp(path.join(projectRoot, target.source), outputPath, {
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

async function watchResources(target: (typeof resourceTargets)[number]) {
  for await (const _event of watch(path.join(projectRoot, target.source), {
    recursive: true,
    signal: buildLifetime.signal,
  })) {
    await copyResources(target)
    console.log(`Copied ${target.name} resources.`)
  }
}

async function runBuild() {
  await prepareBuildDirectories()
  await Promise.all(resourceTargets.map(copyResources))
  if (buildLifetime.signal.aborted) return

  const tasks = buildTargets.map(buildTarget)
  if (isWatchMode) {
    tasks.push(...resourceTargets.map(watchResources))
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
