import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type http from 'node:http'
import path from 'node:path'
import type {
  DesktopEventChannel,
  DesktopEventMap,
  DesktopRequestChannel,
  DesktopRequestHandlerMap,
} from '../../../../shared/desktop-ipc'
import { writeBrowserUploadComposerAttachmentsFromMultipart } from '../../../desktop-host/browser-upload-attachments'
import {
  type HeadlessAuthState,
  handleHeadlessAuthRequest,
  hasAuthenticatedSession,
  hasTrustedBrowserOrigin,
} from './auth'
import { readJsonBody, sendJson, sendText } from './http-response'

const bridgeToken = randomUUID()
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

export type HeadlessRequestContext = {
  allSseClients: Set<http.ServerResponse>
  auth: HeadlessAuthState
  desktopEventClients: Set<http.ServerResponse>
  handlers: DesktopRequestHandlerMap
  indexHtml: string
  isTrustedHost: (host: string | undefined) => boolean
  rendererDistDirectory: string
  terminalEventClients: Set<http.ServerResponse>
}

export function sendHeadlessSseEvent<TChannel extends DesktopEventChannel>(
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

function hasValidBridgeToken(request: http.IncomingMessage) {
  return request.headers['x-howcode-dev-web-bridge-token'] === bridgeToken
}

function requestIsAuthorised(
  context: Pick<HeadlessRequestContext, 'auth' | 'isTrustedHost'>,
  request: http.IncomingMessage,
) {
  return (
    hasTrustedBrowserOrigin(request, context.isTrustedHost) &&
    hasAuthenticatedSession(request, context.auth) &&
    hasValidBridgeToken(request)
  )
}

function handleBridgeConfig(
  context: Pick<HeadlessRequestContext, 'auth' | 'isTrustedHost'>,
  request: http.IncomingMessage,
  response: http.ServerResponse,
) {
  if (!hasTrustedBrowserOrigin(request, context.isTrustedHost)) {
    sendText(response, 403, 'Forbidden')
    return
  }
  if (!hasAuthenticatedSession(request, context.auth)) {
    sendJson(response, 401, { error: 'Headless access token required.' })
    return
  }
  sendJson(response, 200, { authRequired: context.auth.required, bridgeToken })
}

function handleBridgeEvents(
  context: Pick<
    HeadlessRequestContext,
    'allSseClients' | 'auth' | 'desktopEventClients' | 'isTrustedHost' | 'terminalEventClients'
  >,
  request: http.IncomingMessage,
  response: http.ServerResponse,
  pathname: string,
) {
  if (!hasTrustedBrowserOrigin(request, context.isTrustedHost)) {
    sendText(response, 403, 'Forbidden')
    return
  }
  if (!hasAuthenticatedSession(request, context.auth)) {
    sendText(response, 401, 'Headless access token required.')
    return
  }
  const channel = pathname.slice('/__howcode/events/'.length)
  if (channel !== 'desktopEvent' && channel !== 'terminalEvent') {
    sendJson(response, 404, { error: `Unknown desktop event channel: ${channel}` })
    return
  }
  const clients =
    channel === 'terminalEvent' ? context.terminalEventClients : context.desktopEventClients
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
  })
  response.write('retry: 1000\n\n')
  clients.add(response)
  context.allSseClients.add(response)
  request.on('close', () => {
    clients.delete(response)
    context.allSseClients.delete(response)
  })
}

async function invokeBridgeRequest(
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

function handleBridgeRequest(
  context: Pick<HeadlessRequestContext, 'auth' | 'handlers' | 'isTrustedHost'>,
  request: http.IncomingMessage,
  response: http.ServerResponse,
  pathname: string,
) {
  if (!requestIsAuthorised(context, request)) {
    sendText(response, 403, 'Forbidden')
    return
  }
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Desktop bridge requests must use POST.' })
    return
  }
  const channel = pathname.slice('/__howcode/request/'.length)
  void invokeBridgeRequest(context.handlers, channel as DesktopRequestChannel, request, response)
}

async function handleBrowserUpload(
  context: Pick<HeadlessRequestContext, 'auth' | 'isTrustedHost'>,
  request: http.IncomingMessage,
  response: http.ServerResponse,
) {
  if (!requestIsAuthorised(context, request)) {
    sendText(response, 403, 'Forbidden')
    return
  }
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Upload requests must use POST.' })
    return
  }
  try {
    const attachments = await writeBrowserUploadComposerAttachmentsFromMultipart(
      request,
      request.headers['content-type'],
    )
    sendJson(response, 200, { attachments })
  } catch (error) {
    console.error('headless browser upload failed', { error })
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Browser upload failed.',
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
      if (response.headersSent) response.destroy()
      else sendText(response, 500, 'Failed to read file')
    })
    .pipe(response)
}

export function handleHeadlessHttpRequest(
  context: HeadlessRequestContext,
  request: http.IncomingMessage,
  response: http.ServerResponse,
) {
  const { pathname } = new URL(request.url ?? '/', 'http://headless')
  if (pathname === '/__howcode/auth') {
    void handleHeadlessAuthRequest(request, response, context.auth, context.isTrustedHost)
    return
  }
  if (pathname === '/__howcode/config') {
    handleBridgeConfig(context, request, response)
    return
  }
  if (pathname.startsWith('/__howcode/events/')) {
    handleBridgeEvents(context, request, response, pathname)
    return
  }
  if (pathname.startsWith('/__howcode/request/')) {
    handleBridgeRequest(context, request, response, pathname)
    return
  }
  if (pathname === '/__howcode/upload/composer-attachments') {
    void handleBrowserUpload(context, request, response)
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
