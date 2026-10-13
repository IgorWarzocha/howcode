import crypto from 'node:crypto'
import { rmSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer, type ViteDevServer } from 'vite'
import {
  DEV_SERVER_HOST,
  DEV_SERVER_METADATA_RELATIVE_PATH,
  DEV_SERVER_START_PORT,
  isDevServerLoopbackHost,
  isDevServerWildcardHost,
  resolveDevServerListenHost,
  resolveDevServerPublicHost,
} from '../shared/dev-server'
import { getSystemNodeExecutable } from '../src/desktop-host/node-discovery'
import { createDevRuntimeReload } from './dev-runtime-reload'
import { getDevUserDataPath } from './dev-user-data-path'
import { createDevWebAccess } from './dev-web-access'
import { startDevWebBridge } from './dev-web-runtime'

const directoryRoot = process.cwd()
const buildRoot = path.resolve(
  getEnvironmentVariable('HOWCODE_BUILD_ROOT') || path.join(directoryRoot, 'build'),
)
const revisionPattern = /^[0-9]+-[a-f0-9-]+$/
const devServerMetadataPath = path.join(buildRoot, path.basename(DEV_SERVER_METADATA_RELATIVE_PATH))
const readyPath = path.join(buildRoot, 'dev-runtime-ready.json')
const runtimeRoot = path.join(buildRoot, 'dev-runtime')
const devServerListenHost = resolveDevServerListenHost()
const devServerPublicHost = resolveDevServerPublicHost(devServerListenHost)
const allowRemoteRendererHosts =
  isDevServerWildcardHost(devServerListenHost) || !isDevServerLoopbackHost(devServerListenHost)
const bridgeToken = crypto.randomUUID()
const terminalOwnerToken = crypto.randomUUID()
function getEnvironmentVariable(name: string) {
  return process.env[name]
}
const devWebAccess = createDevWebAccess({
  allowRemoteRendererHosts,
  configuredAccessToken:
    getEnvironmentVariable('HOWCODE_DEV_WEB_TOKEN')?.trim() ||
    getEnvironmentVariable('HOWCODE_HEADLESS_TOKEN')?.trim() ||
    null,
})
let bridge: ReturnType<typeof startDevWebBridge> | null = null
let terminalOwner: ReturnType<typeof startDevWebBridge> | null = null
let terminalOwnerRevision: string | null = null
let activeRevision: string | null = null
let server: ViteDevServer | null = null
let isShuttingDown = false
const lifetime = new AbortController()
const nodeExecutable = await getSystemNodeExecutable()

const reload = createDevRuntimeReload({
  inspect: () =>
    bridge?.port
      ? bridge.inspectActivity()
      : Promise.resolve({
          tasks: 0,
          blockedTasks: 0,
          submissions: 0,
          busyComponents: [],
          requests: 0,
        }),
  restart: startBridge,
  report: (message) => console.log(`[howcode] ${message}`),
})

async function startBridge(revision: string) {
  await bridge?.close()
  if (isShuttingDown) return
  if (!terminalOwner?.port)
    throw new Error('Dev terminal owner is unavailable. Restart dev to recover.')
  activeRevision = revision
  bridge = startDevWebBridge({
    root: directoryRoot,
    buildRoot: path.join(runtimeRoot, revision),
    nodeExecutable,
    userDataPath: getDevUserDataPath(),
    token: bridgeToken,
    terminalOwner: {
      url: `http://${DEV_SERVER_HOST}:${terminalOwner.port}`,
      token: terminalOwnerToken,
    },
    onUnexpectedExit: (error) =>
      console.error(`[howcode] ${error.message} Save a runtime edit or restart dev to recover.`),
  })
  try {
    await bridge.ready
  } catch (error) {
    await bridge.close()
    throw error
  }
}

async function readRevision() {
  let contents: string
  try {
    contents = await readFile(readyPath, 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null
    throw error
  }
  const value: unknown = JSON.parse(contents)
  if (
    typeof value !== 'object' ||
    value === null ||
    !('revision' in value) ||
    typeof value.revision !== 'string' ||
    !revisionPattern.test(value.revision)
  ) {
    throw new Error('Invalid dev runtime build stamp.')
  }
  return value.revision
}

async function waitForBuild() {
  const deadline = Date.now() + 30_000
  while (!lifetime.signal.aborted) {
    const revision = await readRevision()
    if (revision) return revision
    if (Date.now() >= deadline)
      throw new Error('Timed out waiting for dev:runtime. Run bun run dev.')
    await delay(150, undefined, { signal: lifetime.signal })
  }
  throw new Error('dev:web stopped.')
}

async function watchBuilds() {
  while (!lifetime.signal.aborted) {
    const revision = await readRevision()
    if (revision) {
      reload.request(revision)
      await reload.check()
      // Immutable bundles keep deferred reloads and overlapping builds from mixing versions.
      for (const entry of await readdir(runtimeRoot, { withFileTypes: true })) {
        if (
          entry.isDirectory() &&
          revisionPattern.test(entry.name) &&
          entry.name < revision &&
          entry.name !== activeRevision &&
          entry.name !== terminalOwnerRevision
        ) {
          await rm(path.join(runtimeRoot, entry.name), { recursive: true, force: true })
        }
      }
    }
    await delay(1_000, undefined, { signal: lifetime.signal })
  }
}

async function shutdown(exitCode = 0) {
  if (isShuttingDown) return
  isShuttingDown = true
  lifetime.abort()
  reload.stop()
  try {
    try {
      await Promise.all([bridge?.close(), removeDevServerMetadata(), server?.close()])
    } finally {
      await terminalOwner?.close()
    }
  } finally {
    process.exit(exitCode)
  }
}

function proxyDevWebBridgeRequest(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  events: boolean,
) {
  const done = events ? (reload.gated ? null : () => undefined) : reload.admit()
  if (!(done && bridge?.port)) {
    done?.()
    response.writeHead(503, { 'content-type': 'application/json', 'retry-after': '1' })
    response.end(
      JSON.stringify({ error: 'Dev backend is reloading or unavailable. Try again shortly.' }),
    )
    return
  }
  const proxyRequest = http.request(
    {
      hostname: DEV_SERVER_HOST,
      port: bridge.port,
      method: request.method,
      path: request.url,
      headers: {
        ...request.headers,
        'x-howcode-dev-web-bridge-token': bridgeToken,
      },
    },
    (proxyResponse) => {
      proxyResponse.once('end', done)
      proxyResponse.once('error', done)
      response.writeHead(proxyResponse.statusCode ?? 500, proxyResponse.headers)
      proxyResponse.pipe(response)
      response.on('close', () => {
        if (events) proxyResponse.destroy()
        else proxyResponse.resume()
      })
    },
  )

  proxyRequest.on('error', (error) => {
    done()
    if (response.headersSent) {
      response.destroy(error)
      return
    }

    response.statusCode = 502
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.end(JSON.stringify({ error: error.message }))
  })

  request.on('close', () => {
    if (!request.complete) {
      proxyRequest.destroy()
      done()
    }
  })

  request.pipe(proxyRequest)
}

async function writeDevServerMetadata(url: string, port: number) {
  await mkdir(path.dirname(devServerMetadataPath), { recursive: true })
  await writeFile(
    devServerMetadataPath,
    JSON.stringify(
      {
        host: devServerListenHost,
        accessHost: devServerPublicHost,
        port,
        url,
      },
      null,
      2,
    ),
  )
}

async function removeDevServerMetadata() {
  await rm(devServerMetadataPath, { force: true })
}

process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())
process.once('exit', () => {
  bridge?.kill()
  terminalOwner?.kill()
  try {
    rmSync(devServerMetadataPath, { force: true })
  } catch {
    // Best-effort cleanup during process exit.
  }
})

try {
  const initialRevision = await waitForBuild()
  terminalOwnerRevision = initialRevision
  terminalOwner = startDevWebBridge({
    root: directoryRoot,
    buildRoot: path.join(runtimeRoot, initialRevision),
    nodeExecutable,
    userDataPath: getDevUserDataPath(),
    token: terminalOwnerToken,
    entrypoint: 'dev-terminal-owner.mjs',
    onUnexpectedExit: (error) => {
      console.error(`[howcode] Dev terminal owner exited: ${error.message}`)
      void shutdown(1)
    },
  })
  await terminalOwner.ready
  await startBridge(initialRevision)
  reload.initialise(initialRevision)

  const bridgeMiddleware = (
    request: http.IncomingMessage,
    response: http.ServerResponse,
    next: () => void,
  ) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost')

    if (requestUrl.pathname === '/__howcode/auth') {
      void devWebAccess.handleAuthRequest(request, response)
      return
    }

    if (requestUrl.pathname === '/__howcode/config') {
      if (!devWebAccess.authoriseBridgeRequest(request, response)) return
      response.setHeader('content-type', 'application/json; charset=utf-8')
      response.end(JSON.stringify({ authRequired: devWebAccess.authRequired, bridgeToken }))
      return
    }

    if (
      requestUrl.pathname.startsWith('/__howcode/events') ||
      requestUrl.pathname.startsWith('/__howcode/request/') ||
      requestUrl.pathname === '/__howcode/upload/composer-attachments'
    ) {
      if (!devWebAccess.authoriseBridgeRequest(request, response)) return
      const events = requestUrl.pathname.startsWith('/__howcode/events')
      proxyDevWebBridgeRequest(request, response, events)
      return
    }

    next()
  }

  server = await createServer({
    configFile: path.join(directoryRoot, 'vite.config.ts'),
    configLoader: 'runner',
    plugins: [
      {
        name: 'howcode-dev-web-bridge',
        configureServer(viteServer) {
          viteServer.middlewares.use(bridgeMiddleware)
        },
      },
    ],
    server: {
      host: devServerListenHost,
      port: DEV_SERVER_START_PORT,
      strictPort: false,
    },
  })

  const listenPromise = server.listen()
  let listenError: unknown = null

  void listenPromise.catch((error) => {
    listenError = error
  })

  while (!server.httpServer?.listening) {
    if (listenError) {
      throw listenError
    }

    await delay(25)
  }

  const address = server.httpServer.address()
  if (!address || typeof address === 'string') {
    throw new Error('Vite did not expose a numeric dev-server port.')
  }

  const { port } = address as AddressInfo
  devWebAccess.configureRendererTrust({
    port,
    hosts: new Set([
      `${DEV_SERVER_HOST}:${port}`,
      `${devServerPublicHost}:${port}`,
      ...(isDevServerWildcardHost(devServerListenHost) ? [] : [`${devServerListenHost}:${port}`]),
    ]),
  })
  await writeDevServerMetadata(`http://${devServerPublicHost}:${port}`, port)
  server.printUrls()
  if (allowRemoteRendererHosts) {
    console.warn(
      `[howcode] dev:web is accepting browser hosts on port ${port}. Keep this on a trusted network.`,
    )
    console.warn(
      `[howcode] dev:web access token URL: http://${devServerPublicHost}:${port}/#token=${encodeURIComponent(devWebAccess.accessToken ?? '')}`,
    )
  }
  console.warn('\n[howcode] dev:web server bridge is enabled for project sync/import.\n')
  void watchBuilds().catch((error: unknown) => {
    if (!isShuttingDown)
      console.error('[howcode] Runtime reload watcher stopped; restart dev.', error)
  })
  await listenPromise
} catch (error) {
  console.error(error)
  await shutdown(1)
}
