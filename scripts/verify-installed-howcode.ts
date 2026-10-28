import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const installRoot = process.argv[2]
if (!installRoot) throw new Error('Usage: node scripts/verify-installed-howcode.ts INSTALL_ROOT')
const packageRoot = path.resolve(installRoot, 'node_modules', 'howcode')
const requireFromPackage = createRequire(path.join(packageRoot, 'package.json'))

// Resolve from the installed distribution, never from this checkout's dependency tree.
for (const name of ['node-pty', 'sherpa-onnx-node', 'node:sqlite']) requireFromPackage(name)
const instructions = await import(
  pathToFileURL(requireFromPackage.resolve('@howaboua/pi-durable-project-instructions')).href
)
if (typeof instructions.createProjectInstructions !== 'function') {
  throw new Error('Installed project instructions entrypoint is unavailable')
}
const { compile } = await import(
  pathToFileURL(requireFromPackage.resolve('@tailwindcss/node')).href
)
const { Scanner } = requireFromPackage('@tailwindcss/oxide')
const candidates = new Scanner({}).scanFiles([{ content: '"p-4"', extension: 'js' }])
const compiler = await compile(
  `@import "tailwindcss/theme.css" theme(reference);
@scope ([data-howcode-component="release-smoke"]) to ([data-howcode-component]) {
  @tailwind utilities;
}`,
  {
    base: path.dirname(requireFromPackage.resolve('tailwindcss/package.json')),
    onDependency() {
      // This one-shot compilation does not need dependency watching.
    },
  },
)
if (!compiler.build(candidates).includes('.p-4')) {
  throw new Error('Installed component utility compiler did not emit the scanned utility')
}

const smokeHome = path.resolve(installRoot, 'smoke-home')
const agentDirectory = path.join(smokeHome, '.pi', 'agent')
await mkdir(agentDirectory, { recursive: true })
const server = spawn(
  process.execPath,
  [
    path.join(packageRoot, 'bin', 'howcode.js'),
    '--host',
    '127.0.0.1',
    '--port',
    '5173',
    '--data-path',
    path.resolve(installRoot, 'smoke-profile'),
  ],
  {
    cwd: installRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      HOME: smokeHome,
      XDG_CONFIG_HOME: path.join(smokeHome, '.config'),
      PI_CODING_AGENT_DIR: agentDirectory,
    },
  },
)
const exited = new Promise<number | null>((resolve) => server.once('close', resolve))
let exitCode: number | null = null
try {
  await new Promise<void>((resolve, reject) => {
    // A fresh profile prepares bundled components before listening. Bound CI startup,
    // including native package initialisation, rather than probing the UI or skipping it.
    const timeout = setTimeout(
      () => reject(new Error('Installed server startup timed out')),
      180_000,
    )
    let output = ''
    server.stdout.on('data', (chunk: Buffer) => {
      process.stdout.write(chunk)
      output += chunk.toString()
      if (output.includes('Howcode http://127.0.0.1:5173')) {
        clearTimeout(timeout)
        resolve()
      }
    })
    server.stderr.on('data', (chunk: Buffer) => process.stderr.write(chunk))
    server.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    server.once('close', (code) => {
      clearTimeout(timeout)
      reject(new Error(`Installed server exited before startup: ${code}`))
    })
  })
} finally {
  if (server.exitCode === null) server.kill('SIGTERM')
  const timeout = setTimeout(() => server.kill('SIGKILL'), 30_000)
  exitCode = await exited
  clearTimeout(timeout)
}
if (exitCode !== 0) throw new Error(`Installed server did not shut down cleanly: ${exitCode}`)
console.log('Installed runtime startup and component utility compilation passed.')
