import { execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import type { AppTransport } from '../shared/app-transport'
import type { Project } from '../shared/desktop-contracts'
import type { DesktopRequestHandlerMap } from '../shared/desktop-ipc'
import { getDesktopWorkingDirectory } from '../shared/desktop-working-directory'
import { HOWCODE_RPC_WS_PATH } from '../shared/howcode-rpc'
import type { HowcodeInstanceManifest } from '../shared/howcode-server-contracts'
import { HOWCODE_SERVER_DESCRIPTOR_PATH } from '../shared/howcode-server-contracts'
import { createPiPackagesHandlers } from '../src/electron/main/ipc/request-handlers/pi-packages'
import { createPiSkillsHandlers } from '../src/electron/main/ipc/request-handlers/pi-skills'
import { createPiThreadsHandlers } from '../src/electron/main/ipc/request-handlers/pi-threads'
import { createSkillCreatorHandlers } from '../src/electron/main/ipc/request-handlers/skill-creator'
import { createTerminalHandlers } from '../src/electron/main/ipc/request-handlers/terminal'
import type { DesktopRuntimeModules } from '../src/electron/main/runtime/desktop-runtime-contracts'
import { startLocalHowcodeServer, stopLocalHowcodeServer } from './local-howcode-server'

const execFileAsync = promisify(execFile)

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

function setProcessEnvironmentVariable(name: string, value: string) {
  process.env[name] = value
}

function setDefaultProcessEnvironmentVariable(name: string, value: string) {
  if (!getProcessEnvironmentVariable(name)) {
    setProcessEnvironmentVariable(name, value)
  }
}

type CliOptions = {
  host: string
  port: number
  token: string
  runtimeRoot: string
  webRoot: string | null
}

function readFlag(args: string[], name: string) {
  const prefix = `${name}=`
  const inline = args.find((arg) => arg.startsWith(prefix))
  if (inline) {
    return inline.slice(prefix.length)
  }
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function parseOptions(args = process.argv.slice(2)): CliOptions {
  const host =
    readFlag(args, '--host') ?? getProcessEnvironmentVariable('HOWCODE_SERVER_HOST') ?? '127.0.0.1'
  const portText =
    readFlag(args, '--port') ?? getProcessEnvironmentVariable('HOWCODE_SERVER_PORT') ?? '39317'
  const token =
    readFlag(args, '--token') ??
    getProcessEnvironmentVariable('HOWCODE_SERVER_TOKEN') ??
    randomUUID()
  const runtimeRoot = resolve(
    getProcessEnvironmentVariable('HOWCODE_RUNTIME_ROOT') ?? process.cwd(),
  )
  const webRoot =
    readFlag(args, '--web-root') ?? getProcessEnvironmentVariable('HOWCODE_WEB_ROOT') ?? null
  const port = Number.parseInt(portText, 10)
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`Invalid --port value: ${portText}`)
  }
  return { host, port, runtimeRoot, token, webRoot }
}

type StandaloneInstanceIdentity = {
  instanceId: string
}

function getStandaloneIdentityPath(runtimeRoot: string) {
  return resolve(runtimeRoot, '.howcode', 'howcode-instance.json')
}

async function getStandaloneInstanceId(runtimeRoot: string) {
  const identityPath = getStandaloneIdentityPath(runtimeRoot)
  const identity = (await readFile(identityPath, 'utf8')
    .then((content) => JSON.parse(content) as StandaloneInstanceIdentity)
    .catch(() => null)) as StandaloneInstanceIdentity | null
  if (identity?.instanceId) return identity.instanceId

  const instanceId = randomUUID()
  await mkdir(resolve(identityPath, '..'), { recursive: true })
  await writeFile(
    identityPath,
    `${JSON.stringify({ instanceId }, null, 2)}
`,
  )
  return instanceId
}

function getStandaloneFallbackInstanceId(runtimeRoot: string) {
  return `howcode:${createHash('sha256').update(runtimeRoot).digest('hex').slice(0, 16)}`
}

async function projectExistsOnStandaloneHost(project: Project) {
  const projectPath = project.resolvedId ?? project.id
  return await access(projectPath)
    .then(() => true)
    .catch(() => false)
}

function mapStandaloneProject(project: Project) {
  return {
    id: project.resolvedId ?? project.id,
    latestModifiedMs: project.latestModifiedMs ?? null,
    name: project.name,
    repoOriginUrl: project.repoOriginUrl ?? null,
    threadCount: project.threadCount ?? project.threads.length,
  }
}

function createStandaloneInstanceManifestHandler(input: {
  runtime: DesktopRuntimeModules
  runtimeRoot: string
  serverUrl: string | null
}) {
  return async (): Promise<HowcodeInstanceManifest> => {
    const shellState = await input.runtime.piThreads.loadShellState(getDesktopWorkingDirectory())
    const instanceId = await getStandaloneInstanceId(input.runtimeRoot).catch(() =>
      getStandaloneFallbackInstanceId(input.runtimeRoot),
    )
    const projects = await Promise.all(
      shellState.projects.map(async (project) =>
        (await projectExistsOnStandaloneHost(project)) ? mapStandaloneProject(project) : null,
      ),
    )
    return {
      instanceId,
      instanceName: getProcessEnvironmentVariable('HOWCODE_INSTANCE_NAME') ?? 'Howcode',
      projects: projects.filter((project) => project !== null),
      serverUrl: input.serverUrl,
    }
  }
}

function configureStandalonePiEnvironment(runtimeRoot: string) {
  setDefaultProcessEnvironmentVariable('HOWCODE_REPO_ROOT', runtimeRoot)
  if (process.platform !== 'win32') {
    setProcessEnvironmentVariable('SHELL', resolveStandaloneShell())
  }
  setDefaultProcessEnvironmentVariable(
    'HOWCODE_USER_DATA_PATH',
    resolve(homedir(), '.config', 'howcode'),
  )
  setProcessEnvironmentVariable(
    'PATH',
    `${resolve(runtimeRoot, 'node_modules', '.bin')}:${getProcessEnvironmentVariable('PATH') ?? ''}`,
  )
  setDefaultProcessEnvironmentVariable(
    'PI_PACKAGE_DIR',
    resolve(runtimeRoot, 'node_modules', '@earendil-works', 'pi-coding-agent'),
  )
}

function resolveStandaloneShell() {
  const configuredShell = getProcessEnvironmentVariable('SHELL')
  for (const candidate of [configuredShell, '/bin/bash', '/usr/bin/bash', '/bin/sh']) {
    if (candidate && existsSync(candidate)) return candidate
  }
  return '/bin/sh'
}

async function assertExecutable(name: string, command: string, args: string[]) {
  try {
    await execFileAsync(command, args, { cwd: getDesktopWorkingDirectory(), timeout: 5_000 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Standalone Howcode backend parity check failed for ${name}: ${message}`)
  }
}

async function verifyStandaloneBackendParity(runtime: DesktopRuntimeModules) {
  const cwd = getDesktopWorkingDirectory()
  await access(cwd).catch(() => {
    throw new Error(`Standalone Howcode backend cwd does not exist: ${cwd}`)
  })
  const piPackageDir = getProcessEnvironmentVariable('PI_PACKAGE_DIR') ?? ''
  await access(resolve(piPackageDir, 'package.json')).catch(() => {
    throw new Error(`Standalone Howcode backend PI_PACKAGE_DIR is invalid: ${piPackageDir}`)
  })

  if (process.platform !== 'win32') {
    const shell = getProcessEnvironmentVariable('SHELL')
    await assertExecutable('shell', shell && shell.length > 0 ? shell : '/bin/bash', [
      '-lc',
      'true',
    ])
  }
  await assertExecutable('pi executable', process.platform === 'win32' ? 'pi.cmd' : 'pi', [
    '--version',
  ])
  await runtime.piThreads.loadShellState(cwd)
  await runtime.piThreads.loadComposerState({ projectId: cwd, sessionPath: null })
}

async function importDesktopModule<TModule>(repoRoot: string, fileName: string) {
  const modulePath = resolve(repoRoot, 'build', 'desktop', fileName)
  return (await import(pathToFileURL(modulePath).href)) as TModule
}

async function loadRuntime(repoRoot: string): Promise<DesktopRuntimeModules> {
  const [piThreads, piSkills, skillCreator, terminalManager] = await Promise.all([
    importDesktopModule<DesktopRuntimeModules['piThreads']>(repoRoot, 'pi-threads.mjs'),
    importDesktopModule<DesktopRuntimeModules['piSkills']>(repoRoot, 'pi-skills.mjs'),
    importDesktopModule<DesktopRuntimeModules['skillCreator']>(
      repoRoot,
      'skill-creator-session.mjs',
    ),
    importDesktopModule<DesktopRuntimeModules['terminalManager']>(repoRoot, 'terminal-manager.mjs'),
  ])
  return { piThreads, piSkills, skillCreator, terminalManager }
}

function createStandaloneRequestHandlers(input: {
  runtime: DesktopRuntimeModules
  runtimeRoot: string
  serverUrl: string | null
}): DesktopRequestHandlerMap {
  const { runtime } = input
  const unsupportedDesktopHandler = () => {
    throw new Error('This desktop-only operation is unavailable in standalone server mode.')
  }
  return {
    getHowcodeServerState: unsupportedDesktopHandler,
    getHowcodeInstanceManifest: createStandaloneInstanceManifestHandler(input),
    refreshHowcodeServerState: unsupportedDesktopHandler,
    listHowcodeRemoteEnvironments: unsupportedDesktopHandler,
    saveHowcodeRemoteEnvironment: unsupportedDesktopHandler,
    deleteHowcodeRemoteEnvironment: unsupportedDesktopHandler,
    testHowcodeRemoteEnvironment: unsupportedDesktopHandler,
    setActiveHowcodeRemoteEnvironment: unsupportedDesktopHandler,
    clearActiveHowcodeRemoteEnvironment: unsupportedDesktopHandler,
    getProjectRemoteEnvironmentAssignment: unsupportedDesktopHandler,
    setProjectRemoteEnvironmentAssignment: unsupportedDesktopHandler,
    getAppUpdateState: unsupportedDesktopHandler,
    checkAppUpdate: unsupportedDesktopHandler,
    installAppUpdate: unsupportedDesktopHandler,
    restartAppUpdate: unsupportedDesktopHandler,
    ...createPiThreadsHandlers(runtime.piThreads),
    ...createPiPackagesHandlers(runtime.piThreads),
    ...createPiSkillsHandlers(runtime.piSkills),
    ...createSkillCreatorHandlers(runtime.skillCreator),
    ...createTerminalHandlers(runtime.terminalManager),
    clearClipboardImages: unsupportedDesktopHandler,
    getAttachmentKindsForPaths: unsupportedDesktopHandler,
    listComposerAttachmentEntries: unsupportedDesktopHandler,
    openExternal: unsupportedDesktopHandler,
    openPath: unsupportedDesktopHandler,
    pickComposerAttachments: unsupportedDesktopHandler,
    readClipboardFilePaths: unsupportedDesktopHandler,
    readClipboardImage: unsupportedDesktopHandler,
    readClipboardSnapshot: unsupportedDesktopHandler,
    saveTextToDownloads: unsupportedDesktopHandler,
    searchComposerAttachmentEntries: unsupportedDesktopHandler,
  }
}

function createRuntimeEventTransport(
  runtime: DesktopRuntimeModules,
): Pick<AppTransport, 'subscribe'> {
  return {
    subscribe: (channel, listener) => {
      if (channel === 'desktopEvent') {
        return runtime.piThreads.subscribeDesktopEvents((event) => listener(event as never))
      }
      return runtime.terminalManager.subscribeTerminalEvents((event) => listener(event as never))
    },
  }
}

async function main() {
  const options = parseOptions()
  configureStandalonePiEnvironment(options.runtimeRoot)
  const runtime = await loadRuntime(options.runtimeRoot)
  await verifyStandaloneBackendParity(runtime)
  const server = await startLocalHowcodeServer({
    config: {
      host: options.host,
      port: options.port,
      token: options.token,
      webRoot: options.webRoot,
    },
    eventTransport: createRuntimeEventTransport(runtime),
    handlers: createStandaloneRequestHandlers({
      runtime,
      runtimeRoot: options.runtimeRoot,
      serverUrl: null,
    }),
  })

  const descriptorUrl = new URL(HOWCODE_SERVER_DESCRIPTOR_PATH, server.baseUrl).toString()
  const webSocketUrl = new URL(HOWCODE_RPC_WS_PATH, server.baseUrl)
  webSocketUrl.protocol = webSocketUrl.protocol === 'https:' ? 'wss:' : 'ws:'

  console.log(
    JSON.stringify({
      authToken: server.authToken,
      baseUrl: server.baseUrl,
      descriptorUrl,
      webSocketUrl: webSocketUrl.toString(),
      webUrl: options.webRoot ? server.baseUrl : undefined,
    }),
  )

  const shutdown = async () => {
    await stopLocalHowcodeServer(server)
    await runtime.piThreads.disposeDesktopRuntime?.()
    await runtime.terminalManager.closeAllTerminals?.()
  }

  process.once('SIGINT', () => {
    void shutdown().finally(() => process.exit(0))
  })
  process.once('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0))
  })

  await new Promise(() => {
    // Keep standalone server alive until a signal shuts it down.
  })
}

if (import.meta.main) {
  void main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
