import { randomUUID } from 'node:crypto'
import { watch } from 'node:fs'
import { cp, mkdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { getBundledSkillsDirectory } from '@howaboua/howcode-skills/resources'

const isWatchMode = process.argv.includes('--watch')
const directoryRoot = process.cwd()
const buildRoot = path.resolve(
  getEnvironmentVariable('HOWCODE_BUILD_ROOT') || path.join(directoryRoot, 'build'),
)

function getEnvironmentVariable(name: string) {
  return process.env[name]
}
const buildLifetime = new AbortController()
let shutdownRequested = false

const buildTargets = [
  {
    label: 'server-runtime',
    entrypoints: [path.join(directoryRoot, 'src', 'server', 'index.ts')],
    outdir: path.join(buildRoot, 'server'),
    root: path.join(directoryRoot, 'src', 'server'),
    naming: { entry: '[name].mjs' },
    format: 'esm',
  },
  {
    label: 'desktop-runtime',
    entrypoints: [
      path.join(directoryRoot, 'desktop', 'service-host.ts'),
      path.join(directoryRoot, 'desktop', 'service-host-runtime.ts'),
      path.join(directoryRoot, 'desktop', 'package-cli.ts'),
    ],
    outdir: path.join(buildRoot, 'desktop'),
    root: path.join(directoryRoot, 'desktop'),
    naming: {
      entry: '[name].mjs',
    },
    format: 'esm',
  },
] as const

const resourceTargets = [
  { source: path.join(directoryRoot, 'desktop/resources/themes'), name: 'themes' },
  { source: getBundledSkillsDirectory(), name: 'skills' },
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
  await cp(target.source, outputPath, {
    recursive: true,
  })
}

async function buildTarget(target: (typeof buildTargets)[number]) {
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
    ],
    { cwd: directoryRoot, stdio: ['ignore', 'inherit', 'inherit'], signal: buildLifetime.signal },
  )
  const exitCode = await child.exited
  if (buildLifetime.signal.aborted) return
  if (exitCode !== 0) {
    throw new Error(`${target.label} build exited with ${exitCode}.`)
  }
  console.log(`Built ${target.label}.`)
}

const watchTargets = [
  ...buildTargets,
  {
    label: 'dev-web-bridge',
    entrypoints: [path.join(directoryRoot, 'scripts', 'dev-web-bridge-node.ts')],
    outdir: buildRoot,
    root: path.join(directoryRoot, 'scripts'),
    naming: { entry: 'dev-web-bridge.mjs' },
    format: 'esm',
  },
  {
    label: 'dev-terminal-owner',
    entrypoints: [path.join(directoryRoot, 'scripts', 'dev-terminal-owner-node.ts')],
    outdir: buildRoot,
    root: path.join(directoryRoot, 'scripts'),
    naming: { entry: 'dev-terminal-owner.mjs' },
    format: 'esm',
  },
] as const

let lastRevisionTime = 0

async function publishWatchBuild() {
  // No target writes to disk until every target has compiled successfully.
  const builds = await Promise.allSettled(
    watchTargets.map(async (target) => {
      const result = await Bun.build({
        entrypoints: [...target.entrypoints],
        root: target.root,
        target: 'node',
        format: target.format,
        packages: 'external',
        sourcemap: 'linked',
        naming: target.naming,
        throw: false,
      })
      if (!result.success) throw new AggregateError(result.logs, `${target.label} build failed.`)
      return { target, outputs: result.outputs }
    }),
  )
  const results = builds.map((build) => {
    if (build.status === 'rejected') throw build.reason
    return build.value
  })
  if (buildLifetime.signal.aborted) return

  lastRevisionTime = Math.max(Date.now(), lastRevisionTime + 1)
  const revision = `${lastRevisionTime}-${randomUUID()}`
  const generationRoot = path.join(buildRoot, 'dev-runtime', revision)
  const stagingRoot = path.join(buildRoot, 'dev-runtime', `.building-${revision}`)
  let published = false
  try {
    await mkdir(stagingRoot, { recursive: true })
    for (const target of resourceTargets) {
      await cp(target.source, path.join(stagingRoot, 'resources', target.name), { recursive: true })
    }
    for (const { target, outputs } of results) {
      for (const output of outputs) {
        const destination = path.join(target.outdir, path.relative(directoryRoot, output.path))
        const stagedOutput = path.join(stagingRoot, path.relative(buildRoot, destination))
        await mkdir(path.dirname(stagedOutput), { recursive: true })
        await Bun.write(stagedOutput, output)
      }
    }
    if (buildLifetime.signal.aborted) return
    const stamp = path.join(stagingRoot, 'dev-runtime-ready.json')
    await Bun.write(stamp, `${JSON.stringify({ revision })}\n`)
    // The stamp only references complete immutable generations. The dev supervisor owns their GC.
    await rename(stagingRoot, generationRoot)
    await rename(
      path.join(generationRoot, 'dev-runtime-ready.json'),
      path.join(buildRoot, 'dev-runtime-ready.json'),
    )
    published = true
    console.log(`Built Node runtime bundles (${revision}).`)
  } finally {
    await rm(stagingRoot, { recursive: true, force: true })
    if (!published) await rm(generationRoot, { recursive: true, force: true })
  }
}

const testSourcePattern = /\.(test|spec)\.[cm]?[jt]sx?$/

function isRuntimeEdit(relativePath: string) {
  if (resourceTargets.some((target) => relativePath.startsWith(`${target.source}${path.sep}`))) {
    return true
  }
  const segments = relativePath.split(path.sep)
  return !(
    segments.includes('ui') ||
    segments.includes('renderer') ||
    relativePath.endsWith('.md') ||
    testSourcePattern.test(relativePath)
  )
}

async function runWatch() {
  let dirty = true
  let inFlight: Promise<void> | undefined
  let debounce: ReturnType<typeof setTimeout> | undefined
  const drain = () => {
    if (inFlight || buildLifetime.signal.aborted) return
    inFlight = (async () => {
      while (dirty && !buildLifetime.signal.aborted) {
        dirty = false
        try {
          await publishWatchBuild()
        } catch (error) {
          console.error('Runtime build failed; waiting for the next edit.', error)
        }
      }
    })().finally(() => {
      inFlight = undefined
    })
  }
  const schedule = () => {
    clearTimeout(debounce)
    debounce = setTimeout(() => {
      dirty = true
      drain()
    }, 150)
  }
  const watchedPaths = [
    'desktop',
    'shared',
    'components',
    'src/server',
    'src/desktop-host',
    'node-runtime',
    'scripts',
  ]
  const watchers: ReturnType<typeof watch>[] = []
  try {
    for (const source of watchedPaths) {
      const watcher = watch(
        path.join(directoryRoot, source),
        { recursive: source !== 'scripts' },
        (_event, name) => {
          // Watch the directory so editor atomic replacement does not detach the bridge watch.
          if (
            source === 'scripts' &&
            name !== 'dev-web-bridge-node.ts' &&
            name !== 'dev-terminal-owner-node.ts'
          )
            return
          if (!name || isRuntimeEdit(path.join(source, name))) schedule()
        },
      )
      watchers.push(watcher)
      watcher.on('error', (error) => {
        console.error(`Runtime watcher failed for ${source}.`, error)
        process.exitCode = 1
        buildLifetime.abort()
      })
    }
    console.log('Watching Node runtime bundles...')
    drain()
    await new Promise<void>((resolve) => {
      if (buildLifetime.signal.aborted) resolve()
      else buildLifetime.signal.addEventListener('abort', () => resolve(), { once: true })
    })
  } finally {
    clearTimeout(debounce)
    for (const watcher of watchers) watcher.close()
    await inFlight
  }
}

async function runBuild() {
  if (isWatchMode) return runWatch()
  await prepareBuildDirectories()
  await Promise.all(resourceTargets.map(copyResources))
  if (buildLifetime.signal.aborted) return

  const tasks = buildTargets.map(buildTarget)
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
