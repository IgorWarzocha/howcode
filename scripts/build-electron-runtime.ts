import { copyFile, cp, mkdir, rm, watch } from 'node:fs/promises'
import path from 'node:path'

const isWatchMode = process.argv.includes('--watch')
const projectRoot = process.cwd()
const buildRoot = path.join(projectRoot, 'build')

const buildTargets = [
  {
    label: 'electron-runtime',
    entrypoints: [
      path.join(projectRoot, 'src', 'electron', 'main', 'index.ts'),
      path.join(projectRoot, 'src', 'electron', 'preload', 'index.ts'),
    ],
    outdir: path.join(buildRoot, 'electron'),
    root: path.join(projectRoot, 'src', 'electron'),
    naming: {
      entry: '[dir]/[name].cjs',
    },
    format: 'cjs',
  },
  {
    label: 'desktop-runtime',
    entrypoints: [
      path.join(projectRoot, 'desktop', 'pi-threads.ts'),
      path.join(projectRoot, 'desktop', 'pi-skills.ts'),
      path.join(projectRoot, 'desktop', 'service-host.ts'),
      path.join(projectRoot, 'desktop', 'service-host-runtime.ts'),
      path.join(projectRoot, 'desktop', 'skill-creator-session.ts'),
      path.join(projectRoot, 'desktop', 'runtime-host', 'worker.ts'),
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
    entrypoints: [path.join(projectRoot, 'desktop', 'terminal', 'manager.ts')],
    outdir: path.join(buildRoot, 'desktop'),
    root: path.join(projectRoot, 'desktop', 'terminal'),
    naming: {
      entry: 'terminal-manager.mjs',
    },
    format: 'esm',
  },
] as const

async function prepareBuildDirectories() {
  await rm(path.join(buildRoot, 'electron'), { recursive: true, force: true })
  await rm(path.join(buildRoot, 'desktop'), { recursive: true, force: true })
  await mkdir(path.join(buildRoot, 'electron'), { recursive: true })
  await mkdir(path.join(buildRoot, 'desktop'), { recursive: true })
}

const nativeAskQuestionsSource = path.join(
  projectRoot,
  'desktop',
  'native-extensions',
  'howcode-native-ask-questions.mjs',
)
const nativeAskQuestionsOutput = path.join(
  buildRoot,
  'desktop',
  'native-extensions',
  'howcode-native-ask-questions.mjs',
)

async function copyNativeExtensionAssets() {
  await mkdir(path.dirname(nativeAskQuestionsOutput), { recursive: true })
  await copyFile(nativeAskQuestionsSource, nativeAskQuestionsOutput)
}

async function copyDesktopResources() {
  const outputPath = path.join(buildRoot, 'resources')
  await rm(outputPath, { recursive: true, force: true })
  await cp(path.join(projectRoot, 'desktop', 'resources'), outputPath, {
    recursive: true,
  })
}

async function runBuild() {
  await prepareBuildDirectories()

  const builds = await Promise.all(
    buildTargets.map((target) =>
      Bun.build({
        entrypoints: [...target.entrypoints],
        outdir: target.outdir,
        root: target.root,
        naming: target.naming,
        target: 'node',
        format: target.format,
        packages: 'external',
        sourcemap: 'linked',
        watch: isWatchMode,
        throw: true,
      } as Bun.BuildConfig & { watch?: boolean }),
    ),
  )

  for (const [index, build] of builds.entries()) {
    console.log(
      `Built ${buildTargets[index]?.label ?? `target-${index}`} (${build.outputs.length} output(s)).`,
    )
  }

  await copyNativeExtensionAssets()
  await copyDesktopResources()

  if (isWatchMode) {
    console.log('Watching Electron runtime bundles...')
    void (async () => {
      for await (const event of watch(path.dirname(nativeAskQuestionsSource))) {
        if (!event.filename || event.filename === path.basename(nativeAskQuestionsSource)) {
          await copyNativeExtensionAssets()
          console.log('Copied native extension assets.')
        }
      }
    })()
    void (async () => {
      for await (const _event of watch(path.join(projectRoot, 'desktop', 'resources'), {
        recursive: true,
      })) {
        await copyDesktopResources()
        console.log('Copied desktop resources.')
      }
    })()
    await new Promise(() => {
      setInterval(() => {
        // Keep the watch process alive.
      }, 1 << 30)
    })
  }
}

void runBuild().catch((error) => {
  console.error(error)
  process.exit(1)
})
