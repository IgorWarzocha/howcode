import { type ChildProcess, spawn } from 'node:child_process'
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
  path.join(projectRoot, 'build', 'desktop', 'skill-creator-session.mjs'),
  path.join(projectRoot, 'build', 'desktop', 'worker.mjs'),
  path.join(projectRoot, 'build', 'desktop', 'terminal-manager.mjs'),
  path.join(projectRoot, 'build', 'dev-server.json'),
]

let electronProcess: ChildProcess | null = null
let restartTimer: NodeJS.Timeout | null = null

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
  while (!watchedFiles.every((filePath) => existsSync(filePath))) {
    await wait(150)
  }
}

async function startElectronProcess() {
  const electronBinary = await ensureElectronBinary()

  const child = spawn(electronBinary, [entryFile], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      HOWCODE_REPO_ROOT: projectRoot,
      HOWCODE_NODE_PATH: electronBinary,
      HOWCODE_RUNTIME_HOST_ELECTRON_NODE: '1',
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
}

function stopElectronProcess() {
  if (!electronProcess) {
    return
  }

  electronProcess.kill('SIGTERM')
  electronProcess = null
}

function scheduleRestart() {
  if (restartTimer) {
    clearTimeout(restartTimer)
  }

  restartTimer = setTimeout(() => {
    stopElectronProcess()
    void startElectronProcess()
  }, 200)
}

async function main() {
  await waitForBuildArtifacts()
  await startElectronProcess()

  for (const filePath of watchedFiles) {
    watchFile(filePath, { interval: 250 }, (current, previous) => {
      if (current.mtimeMs !== previous.mtimeMs) {
        scheduleRestart()
      }
    })
  }

  const cleanup = () => {
    if (restartTimer) {
      clearTimeout(restartTimer)
      restartTimer = null
    }

    for (const filePath of watchedFiles) {
      unwatchFile(filePath)
    }

    stopElectronProcess()
  }

  process.once('SIGINT', () => {
    cleanup()
    process.exit(0)
  })
  process.once('SIGTERM', () => {
    cleanup()
    process.exit(0)
  })
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
