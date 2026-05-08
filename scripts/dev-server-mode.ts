import { type ChildProcess, spawn } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { ensureElectronBinary } from './electron-binary'

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

const projectRoot = process.cwd()
const serverPort = getProcessEnvironmentVariable('HOWCODE_SERVER_PORT') ?? '39317'
const serverToken = getProcessEnvironmentVariable('HOWCODE_SERVER_TOKEN') ?? 'dev-token'
const serverUrl = `http://127.0.0.1:${serverPort}`
const runtimeEntry = path.join(projectRoot, 'build', 'desktop', 'standalone-howcode-server.mjs')
const electronMainEntry = path.join(projectRoot, 'build', 'electron', 'main', 'index.cjs')
const preloadEntry = path.join(projectRoot, 'build', 'electron', 'preload', 'index.cjs')
const devServerMetadata = path.join(projectRoot, 'build', 'dev-server.json')
const buildPaths = [
  path.join(projectRoot, 'artifacts', 'electron'),
  path.join(projectRoot, 'dist'),
  path.join(projectRoot, 'build', 'electron'),
  path.join(projectRoot, 'build', 'desktop'),
  devServerMetadata,
]

const children = new Set<ChildProcess>()

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function spawnManaged(name: string, command: string, args: string[], env = process.env) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  })
  children.add(child)
  child.on('exit', (code, signal) => {
    children.delete(child)
    if (code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGINT') {
      console.error(`${name} exited with code ${code ?? 'null'}${signal ? ` (${signal})` : ''}`)
      shutdown(code ?? 1)
    }
  })
  return child
}

function shutdown(code = 0) {
  for (const child of children) {
    child.kill('SIGTERM')
  }
  setTimeout(() => process.exit(code), 150)
}

async function waitForFiles(files: string[]) {
  while (!files.every((file) => existsSync(file))) {
    await wait(150)
  }
}

async function waitForServer() {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${serverUrl}/.well-known/howcode/server`)
      if (response.ok) return
    } catch {
      // keep waiting
    }
    await wait(200)
  }
  throw new Error(`Timed out waiting for Howcode server at ${serverUrl}.`)
}

async function main() {
  for (const buildPath of buildPaths) {
    rmSync(buildPath, { force: true, recursive: true })
  }

  const electronBinary = await ensureElectronBinary()

  spawnManaged('dev:web', 'bun', ['run', 'dev:web'])
  spawnManaged('dev:runtime', 'bun', ['run', 'dev:runtime'])

  await waitForFiles([runtimeEntry, electronMainEntry, preloadEntry, devServerMetadata])

  spawnManaged(
    'howcode-server',
    electronBinary,
    [runtimeEntry, '--repo-root', '.', '--port', serverPort, '--token', serverToken],
    { ELECTRON_RUN_AS_NODE: '1', HOWCODE_REPO_ROOT: projectRoot },
  )
  await waitForServer()

  spawnManaged('dev:desktop', 'bun', ['run', 'dev:desktop'], {
    HOWCODE_SERVER_URL: serverUrl,
    HOWCODE_SERVER_TOKEN: serverToken,
  })
}

process.once('SIGINT', () => shutdown(0))
process.once('SIGTERM', () => shutdown(0))

void main().catch((error) => {
  console.error(error)
  shutdown(1)
})
