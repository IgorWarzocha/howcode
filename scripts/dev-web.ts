import { type ChildProcess, spawn } from 'node:child_process'
import crypto from 'node:crypto'
import { existsSync, rmSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
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
import { getDevUserDataPath } from './dev-user-data-path'

const projectRoot = process.cwd()
const devRepoRoot = projectRoot
const devServerMetadataPath = path.join(projectRoot, DEV_SERVER_METADATA_RELATIVE_PATH)
const bridgeBuildPath = path.join(projectRoot, 'build', 'dev-web-bridge.mjs')
const serviceHostBuildPath = path.join(projectRoot, 'build', 'desktop', 'service-host.mjs')
const devServerListenHost = resolveDevServerListenHost()
const devServerPublicHost = resolveDevServerPublicHost(devServerListenHost)
const allowRemoteRendererHosts =
  isDevServerWildcardHost(devServerListenHost) || !isDevServerLoopbackHost(devServerListenHost)
const bridgeToken = crypto.randomUUID()
function getEnvironmentVariable(name: string) {
  return process.env[name]
}
const devWebAuthRequired = allowRemoteRendererHosts
const devWebAccessToken =
  getEnvironmentVariable('HOWCODE_DEV_WEB_TOKEN')?.trim() ||
  getEnvironmentVariable('HOWCODE_HEADLESS_TOKEN')?.trim() ||
  (devWebAuthRequired ? `hc_${crypto.randomBytes(18).toString('base64url')}` : null)
const devWebSessionToken = crypto.randomUUID()
function getDevWebSessionCookieName(port: number | null) {
  return `howcode_dev_web_session_${port ?? 'pending'}`
}
const serviceHostWaitTimeoutMs = 30_000

let bridge: { child: ChildProcess; port: number } | null = null
let server: ViteDevServer | null = null
let isShuttingDown = false
let trustedRendererPort: number | null = null
let trustedRendererHosts = new Set<string>()

async function buildDevWebBridge() {
  await mkdir(path.dirname(bridgeBuildPath), { recursive: true })
  const result = await Bun.build({
    entrypoints: [path.join(projectRoot, 'scripts', 'dev-web-bridge-node.ts')],
    outdir: path.dirname(bridgeBuildPath),
    naming: path.basename(bridgeBuildPath),
    target: 'node',
    format: 'esm',
    packages: 'external',
    sourcemap: 'linked',
    throw: true,
  })

  console.log(`Built dev:web bridge (${result.outputs.length} output(s)).`)
}

async function shutdown(exitCode = 0) {
  if (isShuttingDown) {
    return
  }

  isShuttingDown = true

  try {
    bridge?.child.kill()
    await removeDevServerMetadata()
    await server?.close()
  } finally {
    process.exit(exitCode)
  }
}

async function startDevWebBridge() {
  await buildDevWebBridge()
  const serviceHostWaitStartedAt = Date.now()
  while (!existsSync(serviceHostBuildPath)) {
    if (Date.now() - serviceHostWaitStartedAt > serviceHostWaitTimeoutMs) {
      throw new Error(
        `Timed out waiting for ${path.relative(projectRoot, serviceHostBuildPath)}. Is dev:runtime running?`,
      )
    }
    await delay(150)
  }

  const nodeExecutable = await getSystemNodeExecutable()
  const child = spawn(nodeExecutable, [bridgeBuildPath], {
    cwd: projectRoot,
    env: {
      ...process.env,
      HOWCODE_REPO_ROOT: devRepoRoot,
      HOWCODE_USER_DATA_PATH: getDevUserDataPath(),
      HOWCODE_DEV_WEB_BRIDGE_HOST: DEV_SERVER_HOST,
      HOWCODE_DEV_WEB_BRIDGE_PORT: '0',
      HOWCODE_DEV_WEB_BRIDGE_TOKEN: bridgeToken,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stderr?.on('data', (chunk) => {
    process.stderr.write(chunk)
  })

  return new Promise<{ child: ChildProcess; port: number }>((resolve, reject) => {
    let stdoutBuffer = ''
    let settled = false

    const fail = (error: Error) => {
      if (settled) {
        return
      }
      settled = true
      reject(error)
    }

    child.once('error', fail)
    child.once('exit', (code, signal) => {
      if (!settled) {
        fail(new Error(`dev:web bridge exited before startup (code=${code}, signal=${signal}).`))
        return
      }

      console.error(`dev:web bridge exited unexpectedly (code=${code}, signal=${signal}).`)
      void shutdown(1)
    })

    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString()
      stdoutBuffer += text
      process.stdout.write(text)

      const lines = stdoutBuffer.split('\n')
      stdoutBuffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('HOWCODE_DEV_WEB_BRIDGE_READY ')) {
          continue
        }

        const payload = JSON.parse(line.slice('HOWCODE_DEV_WEB_BRIDGE_READY '.length)) as {
          port?: number
        }
        if (typeof payload.port !== 'number') {
          fail(new Error('dev:web bridge reported an invalid port.'))
          return
        }

        settled = true
        resolve({ child, port: payload.port })
        return
      }
    })
  })
}

function proxyDevWebBridgeRequest(
  bridgePort: number,
  request: http.IncomingMessage,
  response: http.ServerResponse,
) {
  const proxyRequest = http.request(
    {
      hostname: DEV_SERVER_HOST,
      port: bridgePort,
      method: request.method,
      path: request.url,
      headers: {
        ...request.headers,
        'x-howcode-dev-web-bridge-token': bridgeToken,
      },
    },
    (proxyResponse) => {
      response.writeHead(proxyResponse.statusCode ?? 500, proxyResponse.headers)
      proxyResponse.pipe(response)
      response.on('close', () => {
        if (!proxyResponse.destroyed) {
          proxyResponse.destroy()
        }
      })
    },
  )

  proxyRequest.on('error', (error) => {
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
    }
  })

  request.pipe(proxyRequest)
}

function isTrustedBrowserRequest(request: http.IncomingMessage) {
  if (trustedRendererPort === null) {
    return false
  }

  const requestHost = request.headers.host
  if (typeof requestHost !== 'string' || !isTrustedRendererHost(requestHost)) {
    return false
  }

  const origin = request.headers.origin
  if (typeof origin !== 'string') {
    return true
  }

  try {
    const originUrl = new URL(origin)
    return isTrustedRendererHost(originUrl.host)
  } catch {
    return false
  }
}

function sendJson(response: http.ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

async function readJsonBody(request: http.IncomingMessage) {
  const chunks: Buffer[] = []
  let byteLength = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    byteLength += buffer.length
    if (byteLength > 16 * 1024) {
      throw new Error('Request body is too large.')
    }
    chunks.push(buffer)
  }

  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

function parseCookieHeader(cookieHeader: string | string[] | undefined) {
  const header = Array.isArray(cookieHeader) ? cookieHeader.join(';') : cookieHeader
  const cookies = new Map<string, string>()
  if (!header) return cookies

  for (const part of header.split(';')) {
    const [rawName, ...rawValueParts] = part.trim().split('=')
    if (!rawName) continue
    try {
      cookies.set(rawName, decodeURIComponent(rawValueParts.join('=')))
    } catch {
      // Ignore malformed cookie values instead of crashing the dev bridge.
    }
  }

  return cookies
}

function hasAuthenticatedDevWebSession(request: http.IncomingMessage) {
  if (!devWebAuthRequired) {
    return true
  }

  return (
    parseCookieHeader(request.headers.cookie).get(
      getDevWebSessionCookieName(trustedRendererPort),
    ) === devWebSessionToken
  )
}

async function handleDevWebAuthRequest(
  request: http.IncomingMessage,
  response: http.ServerResponse,
) {
  if (!isTrustedBrowserRequest(request)) {
    response.statusCode = 403
    response.end('Forbidden')
    return
  }

  if (request.method === 'GET') {
    sendJson(response, 200, {
      required: devWebAuthRequired,
      authenticated: hasAuthenticatedDevWebSession(request),
    })
    return
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Auth requests must use GET or POST.' })
    return
  }

  if (!devWebAuthRequired) {
    sendJson(response, 200, { authenticated: true, required: false })
    return
  }

  const body = (await readJsonBody(request).catch(() => null)) as { token?: unknown } | null
  if (typeof body?.token !== 'string' || body.token !== devWebAccessToken) {
    sendJson(response, 401, { error: 'Invalid access token.' })
    return
  }

  response.setHeader(
    'set-cookie',
    `${getDevWebSessionCookieName(trustedRendererPort)}=${encodeURIComponent(devWebSessionToken)}; Path=/; HttpOnly; SameSite=Lax`,
  )
  sendJson(response, 200, { authenticated: true, required: true })
}

function getHostPort(host: string) {
  try {
    const parsedHost = new URL(`http://${host}`)
    return parsedHost.port ? Number(parsedHost.port) : null
  } catch {
    return null
  }
}

function isTrustedRendererHost(host: string) {
  if (trustedRendererHosts.has(host)) {
    return true
  }

  return allowRemoteRendererHosts && getHostPort(host) === trustedRendererPort
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
  bridge?.child.kill()
  try {
    rmSync(devServerMetadataPath, { force: true })
  } catch {
    // Best-effort cleanup during process exit.
  }
})

try {
  bridge = await startDevWebBridge()

  server = await createServer({
    configFile: path.join(projectRoot, 'vite.config.ts'),
    server: {
      host: devServerListenHost,
      port: DEV_SERVER_START_PORT,
      strictPort: false,
    },
  })

  const bridgeMiddleware = (
    request: http.IncomingMessage,
    response: http.ServerResponse,
    next: () => void,
  ) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost')

    if (requestUrl.pathname === '/__howcode/auth') {
      void handleDevWebAuthRequest(request, response)
      return
    }

    if (requestUrl.pathname === '/__howcode/config') {
      if (!isTrustedBrowserRequest(request)) {
        response.statusCode = 403
        response.end('Forbidden')
        return
      }

      if (!hasAuthenticatedDevWebSession(request)) {
        sendJson(response, 401, { error: 'Headless access token required.' })
        return
      }

      response.setHeader('content-type', 'application/json; charset=utf-8')
      response.end(JSON.stringify({ authRequired: devWebAuthRequired, bridgeToken }))
      return
    }

    if (
      requestUrl.pathname.startsWith('/__howcode/events') ||
      requestUrl.pathname.startsWith('/__howcode/request/') ||
      requestUrl.pathname === '/__howcode/upload/composer-attachments'
    ) {
      if (!isTrustedBrowserRequest(request)) {
        response.statusCode = 403
        response.end('Forbidden')
        return
      }

      if (!hasAuthenticatedDevWebSession(request)) {
        sendJson(response, 401, { error: 'Headless access token required.' })
        return
      }

      proxyDevWebBridgeRequest(bridge?.port ?? 0, request, response)
      return
    }

    next()
  }

  ;(
    server.middlewares as unknown as {
      stack: Array<{ route: string; handle: typeof bridgeMiddleware }>
    }
  ).stack.unshift({
    route: '',
    handle: bridgeMiddleware,
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
  trustedRendererPort = port
  trustedRendererHosts = new Set([
    `${DEV_SERVER_HOST}:${port}`,
    `${devServerPublicHost}:${port}`,
    ...(isDevServerWildcardHost(devServerListenHost) ? [] : [`${devServerListenHost}:${port}`]),
  ])
  await writeDevServerMetadata(`http://${devServerPublicHost}:${port}`, port)
  server.printUrls()
  if (allowRemoteRendererHosts) {
    console.warn(
      `[howcode] dev:web is accepting browser hosts on port ${port}. Keep this on a trusted network.`,
    )
    console.warn(
      `[howcode] dev:web access token URL: http://${devServerPublicHost}:${port}/#token=${encodeURIComponent(devWebAccessToken ?? '')}`,
    )
  }
  console.warn(
    '\n[howcode] dev:web local desktop bridge is enabled for project sync/import. `bun run dev` remains the preferred full desktop dev loop.\n',
  )
  await listenPromise
} catch (error) {
  bridge?.child.kill()
  await removeDevServerMetadata()
  throw error
}
