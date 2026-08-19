import { mkdir } from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { openPathWithSystem } from '../desktop/system-open-path.ts'
import packageJson from '../package.json'
import type { DesktopEventMap, DesktopRequestChannel } from '../shared/desktop-ipc'
import type {
  PiSkillsService,
  PiThreadsService,
  TerminalService,
} from '../shared/desktop-service-contracts'
import { getDesktopWorkingDirectory } from '../shared/desktop-working-directory'
import { getSafeExternalUrl } from '../shared/external-url'
import {
  scheduleBrowserUploadComposerAttachmentsCleanup,
  writeBrowserUploadComposerAttachmentsFromMultipart,
} from '../src/desktop-host/browser-upload-attachments'
import { createDesktopRequestHandlers } from '../src/desktop-host/desktop-requests/handlers'
import {
  createSystemRequestHandlers,
  type DesktopSystemRequestCapabilities,
} from '../src/desktop-host/desktop-requests/system'
import {
  DesktopServiceClient,
  type DesktopServiceModuleName,
} from '../src/desktop-host/desktop-service-client'
import { getSystemNodeExecutable } from '../src/desktop-host/node-discovery'

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

const host = getProcessEnvironmentVariable('HOWCODE_DEV_WEB_BRIDGE_HOST') || '127.0.0.1'
const port = Number(getProcessEnvironmentVariable('HOWCODE_DEV_WEB_BRIDGE_PORT') || 0)
const bridgeToken = getProcessEnvironmentVariable('HOWCODE_DEV_WEB_BRIDGE_TOKEN') || ''

const desktopEventClients = new Set<http.ServerResponse>()
const terminalEventClients = new Set<http.ServerResponse>()
const sseClients = new Set<http.ServerResponse>()
const devAppUpdateState = {
  status: 'up-to-date' as const,
  currentVersion: packageJson.version,
  latestVersion: packageJson.version,
  channel: null,
  error: null,
}

const desktopService = new DesktopServiceClient({
  nodeExecutable: getSystemNodeExecutable,
  serviceHostPath: path.join(process.cwd(), 'build', 'desktop', 'service-host.mjs'),
  cwd: getDesktopWorkingDirectory(),
})

function proxyServiceModule<T extends Record<string, unknown>>(
  moduleName: DesktopServiceModuleName,
) {
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'subscribeDesktopEvents')
          return desktopService.subscribeDesktopEvents.bind(desktopService)
        if (property === 'disposeDesktopRuntime') return desktopService.dispose.bind(desktopService)
        return (...args: unknown[]) =>
          desktopService.invokeDynamic(moduleName, String(property), args)
      },
    },
  ) as T
}

const piThreads = proxyServiceModule<PiThreadsService>('piThreads')
const piSkills = proxyServiceModule<PiSkillsService>('piSkills')
const terminalManager: TerminalService = desktopService.terminalManager

function sendSseEvent<TChannel extends keyof DesktopEventMap>(
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

const devSystemCapabilities = {
  clearClipboardImages: () => ({ clearedCount: 0, clearFailedCount: 0 }),
  pickComposerAttachments: () => [],
  readClipboardSnapshot: () => ({ formats: [], valuesByFormat: {} }),
  readClipboardFilePaths: () => ({ filePaths: [], text: null }),
  readClipboardImage: () => null,
  openExternal: async ({ url }) => {
    const safeUrl = getSafeExternalUrl(url)
    return { ok: Boolean(safeUrl && (await openPathWithSystem(safeUrl))) }
  },
  openPath: async ({ path: targetPath }) => ({ ok: await openPathWithSystem(targetPath) }),
  getDownloadsPath: () => path.join(os.homedir(), 'Downloads'),
  prepareDownloadsDirectory: async (directoryPath) => {
    await mkdir(directoryPath, { recursive: true })
  },
} satisfies DesktopSystemRequestCapabilities

piThreads.subscribeDesktopEvents((event) => {
  sendSseEvent(desktopEventClients, 'desktopEvent', event)
})
terminalManager.subscribeTerminalEvents((event) => {
  sendSseEvent(terminalEventClients, 'terminalEvent', event)
})

const handlers = createDesktopRequestHandlers({
  runtime: { piThreads, piSkills, terminalManager },
  platform: {
    getAppUpdateState: () => devAppUpdateState,
    checkAppUpdate: () => devAppUpdateState,
    installAppUpdate: () => devAppUpdateState,
    restartAppUpdate: () => devAppUpdateState,
    ...createSystemRequestHandlers(devSystemCapabilities),
  },
})

const maxBridgeJsonBodyBytes = 2 * 1024 * 1024

async function readJsonBody(request: http.IncomingMessage, maxBytes = maxBridgeJsonBodyBytes) {
  const chunks: Buffer[] = []
  let byteLength = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    byteLength += buffer.length
    if (byteLength > maxBytes) {
      throw new Error('Request body is too large.')
    }
    chunks.push(buffer)
  }

  if (chunks.length === 0) {
    return {}
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

function sendJson(response: http.ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

async function handleBridgeRequest(
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
    console.error('dev:web bridge request failed', { channel, error })
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Desktop bridge request failed.',
    })
  }
}

async function handleBrowserUploadRequest(
  request: http.IncomingMessage,
  response: http.ServerResponse,
) {
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
    console.error('dev:web browser upload failed', { error })
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Browser upload failed.',
    })
  }
}

function hasValidBridgeToken(request: http.IncomingMessage) {
  return bridgeToken.length > 0 && request.headers['x-howcode-dev-web-bridge-token'] === bridgeToken
}

function handleBridgeEvents(
  channel: keyof DesktopEventMap,
  request: http.IncomingMessage,
  response: http.ServerResponse,
) {
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
  })
  response.write('retry: 1000\n\n')

  const clients = channel === 'terminalEvent' ? terminalEventClients : desktopEventClients
  clients.add(response)
  sseClients.add(response)
  request.on('close', () => {
    clients.delete(response)
    sseClients.delete(response)
  })
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${host}`)

  if (!hasValidBridgeToken(request)) {
    sendJson(response, 403, { error: 'Invalid dev:web bridge token.' })
    return
  }

  if (requestUrl.pathname.startsWith('/__howcode/events/')) {
    const channel = requestUrl.pathname.slice('/__howcode/events/'.length)
    if (channel !== 'desktopEvent' && channel !== 'terminalEvent') {
      sendJson(response, 404, { error: `Unknown desktop event channel: ${channel}` })
      return
    }

    handleBridgeEvents(channel, request, response)
    return
  }

  if (requestUrl.pathname.startsWith('/__howcode/request/')) {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Desktop bridge requests must use POST.' })
      return
    }

    const channel = requestUrl.pathname.slice('/__howcode/request/'.length)
    void handleBridgeRequest(channel as DesktopRequestChannel, request, response)
    return
  }

  if (requestUrl.pathname === '/__howcode/upload/composer-attachments') {
    void handleBrowserUploadRequest(request, response)
    return
  }

  sendJson(response, 404, { error: 'Unknown dev:web bridge endpoint.' })
})

server.listen(port, host, () => {
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('dev:web bridge did not expose a numeric port.')
  }

  scheduleBrowserUploadComposerAttachmentsCleanup({
    onError: (error) => console.warn('dev:web browser upload cleanup failed', { error }),
  })
  console.log(`HOWCODE_DEV_WEB_BRIDGE_READY ${JSON.stringify({ host, port: address.port })}`)
})

function shutdown() {
  for (const client of sseClients) {
    client.end()
    client.destroy()
  }
  sseClients.clear()
  desktopEventClients.clear()
  terminalEventClients.clear()

  server.close(() => process.exit(0))
  server.closeAllConnections()
  setTimeout(() => process.exit(0), 750).unref()
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
