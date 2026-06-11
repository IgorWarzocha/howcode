import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import type {
  DesktopEventChannel,
  DesktopEventMap,
  DesktopRequestChannel,
  DesktopRequestHandlerMap,
} from '../../../../shared/desktop-ipc'
import type { DesktopServiceRuntime } from '../../../../shared/desktop-service-contracts'
import { isDevServerLoopbackHost, isDevServerWildcardHost } from '../../../../shared/dev-server'
import { createDesktopRequestHandlers } from '../ipc/desktop-request-handlers'
import { getRendererDistDirectory } from '../runtime/app-paths'
import type { AppUpdater } from '../updater/app-updater'
import type { HeadlessServerOptions } from './options'

const leadingSlashesPattern = /^\/+/

const mimeTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
}

type HeadlessServerInput = {
  runtime: DesktopServiceRuntime
  appUpdater: AppUpdater
  options: Pick<HeadlessServerOptions, 'host' | 'port'>
  onSettingsChanged?: (() => Promise<void> | void) | undefined
}

type HeadlessRequestContext = {
  allSseClients: Set<http.ServerResponse>
  desktopEventClients: Set<http.ServerResponse>
  handlers: DesktopRequestHandlerMap
  indexHtml: string
  isTrustedHost: (host: string | undefined) => boolean
  rendererDistDirectory: string
  terminalEventClients: Set<http.ServerResponse>
}

const headlessBridgeToken = randomUUID()

function sendJson(response: http.ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

function sendText(response: http.ServerResponse, statusCode: number, message: string) {
  response.statusCode = statusCode
  response.setHeader('content-type', 'text/plain; charset=utf-8')
  response.end(message)
}

async function readJsonBody(request: http.IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  if (chunks.length === 0) {
    return {}
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

function getHostPort(host: string) {
  try {
    const parsedHost = new URL(`http://${host}`)
    return parsedHost.port ? Number(parsedHost.port) : null
  } catch {
    return null
  }
}

function createHostTrust(options: Pick<HeadlessServerOptions, 'host' | 'port'>) {
  const trustedHosts = new Set([
    `127.0.0.1:${options.port}`,
    `localhost:${options.port}`,
    `${options.host}:${options.port}`,
  ])
  const allowAnyHostOnPort =
    isDevServerWildcardHost(options.host) || !isDevServerLoopbackHost(options.host)

  return (host: string | undefined) => {
    if (!host) {
      return false
    }

    if (trustedHosts.has(host)) {
      return true
    }

    return allowAnyHostOnPort && getHostPort(host) === options.port
  }
}

function hasTrustedBrowserOrigin(
  request: http.IncomingMessage,
  isTrustedHost: (host: string | undefined) => boolean,
) {
  if (!isTrustedHost(request.headers.host)) {
    return false
  }

  const origin = request.headers.origin
  if (typeof origin !== 'string') {
    return true
  }

  try {
    return isTrustedHost(new URL(origin).host)
  } catch {
    return false
  }
}

function hasValidBridgeToken(request: http.IncomingMessage) {
  return request.headers['x-howcode-dev-web-bridge-token'] === headlessBridgeToken
}

function sendSseEvent<TChannel extends DesktopEventChannel>(
  clients: Set<http.ServerResponse>,
  channel: TChannel,
  event: DesktopEventMap[TChannel],
) {
  const payload = JSON.stringify({ channel, event })
  for (const client of clients) {
    client.write(`event: ${channel}\n`)
    client.write(`data: ${payload}\n\n`)
  }
}

function handleBridgeEvents(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  clients: Set<http.ServerResponse>,
  allClients: Set<http.ServerResponse>,
) {
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
  })
  response.write('retry: 1000\n\n')

  clients.add(response)
  allClients.add(response)
  request.on('close', () => {
    clients.delete(response)
    allClients.delete(response)
  })
}

async function handleBridgeRequest(
  handlers: DesktopRequestHandlerMap,
  channel: DesktopRequestChannel,
  request: http.IncomingMessage,
  response: http.ServerResponse,
) {
  const handler = handlers[channel]
  if (!handler) {
    sendJson(response, 404, { error: `Unknown desktop request channel: ${channel}` })
    return
  }

  try {
    const params = await readJsonBody(request)
    const result = await (handler as (params: unknown) => Promise<unknown> | unknown)(params)
    sendJson(response, 200, result ?? null)
  } catch (error) {
    console.error('headless desktop bridge request failed', { channel, error })
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Desktop bridge request failed.',
    })
  }
}

function resolveStaticPath(rendererDistDirectory: string, rawPathname: string) {
  let pathname = rawPathname
  try {
    pathname = decodeURIComponent(rawPathname)
  } catch {
    return null
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(leadingSlashesPattern, '')
  const filePath = path.resolve(rendererDistDirectory, relativePath)
  const rendererRoot = path.resolve(rendererDistDirectory)
  return filePath === rendererRoot || filePath.startsWith(`${rendererRoot}${path.sep}`)
    ? filePath
    : null
}

function handleBridgeConfig(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  isTrustedHost: (host: string | undefined) => boolean,
) {
  if (!hasTrustedBrowserOrigin(request, isTrustedHost)) {
    sendText(response, 403, 'Forbidden')
    return
  }

  sendJson(response, 200, { bridgeToken: headlessBridgeToken })
}

function handleBridgeEventRequest(
  context: Pick<
    HeadlessRequestContext,
    'allSseClients' | 'desktopEventClients' | 'isTrustedHost' | 'terminalEventClients'
  >,
  request: http.IncomingMessage,
  response: http.ServerResponse,
  pathname: string,
) {
  if (!hasTrustedBrowserOrigin(request, context.isTrustedHost)) {
    sendText(response, 403, 'Forbidden')
    return
  }

  const channel = pathname.slice('/__howcode/events/'.length)
  if (channel !== 'desktopEvent' && channel !== 'terminalEvent') {
    sendJson(response, 404, { error: `Unknown desktop event channel: ${channel}` })
    return
  }

  handleBridgeEvents(
    request,
    response,
    channel === 'terminalEvent' ? context.terminalEventClients : context.desktopEventClients,
    context.allSseClients,
  )
}

function handleBridgeRequestEndpoint(
  context: Pick<HeadlessRequestContext, 'handlers' | 'isTrustedHost'>,
  request: http.IncomingMessage,
  response: http.ServerResponse,
  pathname: string,
) {
  if (!(hasTrustedBrowserOrigin(request, context.isTrustedHost) && hasValidBridgeToken(request))) {
    sendText(response, 403, 'Forbidden')
    return
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Desktop bridge requests must use POST.' })
    return
  }

  const channel = pathname.slice('/__howcode/request/'.length)
  void handleBridgeRequest(context.handlers, channel as DesktopRequestChannel, request, response)
}

function handleHeadlessHttpRequest(
  context: HeadlessRequestContext,
  request: http.IncomingMessage,
  response: http.ServerResponse,
) {
  const { pathname } = new URL(request.url ?? '/', 'http://headless')

  if (pathname === '/__howcode/config') {
    handleBridgeConfig(request, response, context.isTrustedHost)
    return
  }

  if (pathname.startsWith('/__howcode/events/')) {
    handleBridgeEventRequest(context, request, response, pathname)
    return
  }

  if (pathname.startsWith('/__howcode/request/')) {
    handleBridgeRequestEndpoint(context, request, response, pathname)
    return
  }

  if (pathname === '/') {
    response.statusCode = 200
    response.setHeader('content-type', 'text/html; charset=utf-8')
    response.end(context.indexHtml)
    return
  }

  void serveStaticFile(context.rendererDistDirectory, request, response)
}

async function serveStaticFile(
  rendererDistDirectory: string,
  request: http.IncomingMessage,
  response: http.ServerResponse,
) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendText(response, 405, 'Method Not Allowed')
    return
  }

  const requestUrl = new URL(request.url ?? '/', 'http://headless')
  const candidatePath = resolveStaticPath(rendererDistDirectory, requestUrl.pathname)
  if (!candidatePath) {
    sendText(response, 400, 'Bad Request')
    return
  }

  const filePath = await stat(candidatePath)
    .then((stats) =>
      stats.isFile() ? candidatePath : path.join(rendererDistDirectory, 'index.html'),
    )
    .catch(() => path.join(rendererDistDirectory, 'index.html'))
  const fileStats = await stat(filePath).catch(() => null)
  if (!fileStats?.isFile()) {
    sendText(response, 404, 'Not Found')
    return
  }

  response.statusCode = 200
  response.setHeader('content-length', String(fileStats.size))
  response.setHeader(
    'content-type',
    mimeTypes[path.extname(filePath)] ?? 'application/octet-stream',
  )
  if (request.method === 'HEAD') {
    response.end()
    return
  }

  createReadStream(filePath)
    .on('error', () => {
      if (response.headersSent) {
        response.destroy()
      } else {
        sendText(response, 500, 'Failed to read file')
      }
    })
    .pipe(response)
}

export async function startHeadlessServer(input: HeadlessServerInput) {
  const handlers = createDesktopRequestHandlers(
    input.runtime,
    input.appUpdater,
    input.onSettingsChanged,
  )
  const rendererDistDirectory = getRendererDistDirectory()
  const indexHtmlPath = path.join(rendererDistDirectory, 'index.html')
  const indexHtml = await readFile(indexHtmlPath, 'utf8')
  const isTrustedHost = createHostTrust(input.options)
  const desktopEventClients = new Set<http.ServerResponse>()
  const terminalEventClients = new Set<http.ServerResponse>()
  const allSseClients = new Set<http.ServerResponse>()

  const unsubscribeDesktopEvents = input.runtime.piThreads.subscribeDesktopEvents((event) => {
    sendSseEvent(desktopEventClients, 'desktopEvent', event)
  })
  const unsubscribeTerminalEvents = input.runtime.terminalManager.subscribeTerminalEvents(
    (event) => {
      sendSseEvent(terminalEventClients, 'terminalEvent', event)
    },
  )
  const unsubscribeAppUpdateEvents = input.appUpdater.subscribe((state) => {
    sendSseEvent(desktopEventClients, 'desktopEvent', { type: 'app-update', state })
  })

  const requestContext = {
    allSseClients,
    desktopEventClients,
    handlers,
    indexHtml,
    isTrustedHost,
    rendererDistDirectory,
    terminalEventClients,
  }

  const server = http.createServer((request, response) =>
    handleHeadlessHttpRequest(requestContext, request, response),
  )

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(input.options.port, input.options.host, () => {
      server.off('error', reject)
      resolve()
    })
  })

  server.once('close', () => {
    unsubscribeDesktopEvents()
    unsubscribeTerminalEvents()
    unsubscribeAppUpdateEvents()
    for (const client of allSseClients) {
      client.end()
      client.destroy()
    }
    allSseClients.clear()
    desktopEventClients.clear()
    terminalEventClients.clear()
  })

  return server
}
