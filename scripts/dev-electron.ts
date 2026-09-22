import { type ChildProcess, spawn } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, unwatchFile, watchFile } from 'node:fs'
import path from 'node:path'
import { getDevUserDataPath } from './dev-user-data-path'
import { ensureElectronBinary } from './electron-binary'

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

const projectRoot = process.cwd()
const entryFile = path.join(projectRoot, 'build', 'electron', 'main', 'index.cjs')
const watchedFiles = [
  entryFile,
  path.join(projectRoot, 'build', 'electron', 'preload', 'index.cjs'),
  path.join(projectRoot, 'build', 'desktop', 'pi-threads.mjs'),
  path.join(projectRoot, 'build', 'desktop', 'pi-skills.mjs'),
  path.join(projectRoot, 'build', 'desktop', 'service-host.mjs'),
  path.join(projectRoot, 'build', 'desktop', 'worker.mjs'),
  path.join(projectRoot, 'build', 'desktop', 'terminal-manager.mjs'),
  path.join(projectRoot, 'build', 'dev-server.json'),
]

let electronProcess: ChildProcess | null = null
let restartTimer: NodeJS.Timeout | null = null
let restartTask = Promise.resolve()
let shuttingDown = false

function getRequestedViewport() {
  const viewportArg = process.argv.find((arg) => arg.startsWith('--viewport='))
  if (!viewportArg) {
    return getProcessEnvironmentVariable('HOWCODE_DEV_VIEWPORT')
  }

  return viewportArg.slice('--viewport='.length)
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForBuildArtifacts() {
  while (!(shuttingDown || watchedFiles.every((filePath) => existsSync(filePath)))) {
    await wait(150)
  }
}

async function startElectronProcess() {
  const electronBinary = await ensureElectronBinary()
  if (shuttingDown) return

  const child = spawn(electronBinary, [entryFile], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      HOWCODE_REPO_ROOT: projectRoot,
      HOWCODE_USER_DATA_PATH: getDevUserDataPath(),
      HOWCODE_DEV_VIEWPORT: getRequestedViewport() ?? '',
    },
  })

  electronProcess = child

  child.on('exit', () => {
    if (electronProcess === child) {
      electronProcess = null
    }
  })

  try {
    await once(child, 'spawn')
  } catch (error) {
    if (electronProcess === child) electronProcess = null
    throw error
  }
}

async function stopElectronProcess() {
  const child = electronProcess
  if (!child || child.exitCode !== null || child.signalCode !== null) return

  // Electron's async shutdown must release CDP and its service before a replacement starts.
  const exited = once(child, 'exit')
  child.kill('SIGTERM')
  await exited
}

function restartElectronProcess() {
  restartTask = restartTask
    .then(async () => {
      if (shuttingDown) return
      await stopElectronProcess()
      await startElectronProcess()
    })
    .catch((error) => {
      console.error('Failed to restart Electron.', error)
      void shutdown(1)
    })
  return restartTask
}

function scheduleRestart() {
  if (shuttingDown) return
  if (restartTimer) {
    clearTimeout(restartTimer)
  }

  restartTimer = setTimeout(() => {
    restartTimer = null
    void restartElectronProcess()
  }, 200)
}

async function shutdown(exitCode: number) {
  if (shuttingDown) return
  shuttingDown = true
  if (restartTimer) {
    clearTimeout(restartTimer)
    restartTimer = null
  }

  for (const filePath of watchedFiles) {
    unwatchFile(filePath)
  }

  try {
    await restartTask
    await stopElectronProcess()
    process.exit(exitCode)
  } catch (error) {
    console.error('Failed to stop Electron.', error)
    process.exit(1)
  }
}

async function main() {
  await waitForBuildArtifacts()
  if (shuttingDown) return
  await restartElectronProcess()
  if (shuttingDown) return

  for (const filePath of watchedFiles) {
    watchFile(filePath, { interval: 250 }, (current, previous) => {
      if (current.mtimeMs !== previous.mtimeMs) {
        scheduleRestart()
      }
    })
  }
}

process.on('SIGINT', () => void shutdown(0))
process.on('SIGTERM', () => void shutdown(0))

void main().catch((error) => {
  console.error(error)
  void shutdown(1)
})
