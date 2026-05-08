import { timingSafeEqual } from 'node:crypto'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import path from 'node:path'
import { Data, Effect } from 'effect'
import { WebSocketServer } from 'ws'
import type { AppTransport } from '../../shared/app-transport'
import type {
  DesktopEventChannel,
  DesktopRequestChannel,
  DesktopRequestMap,
} from '../../shared/desktop-ipc'
import {
  HOWCODE_SERVER_DESCRIPTOR_PATH,
  HOWCODE_SERVER_REQUEST_PREFIX,
  HOWCODE_SERVER_WS_PATH,
  howcodeServerDescriptor,
} from '../../shared/howcode-server-contracts'
import type {
  HowcodeServerWsClientMessage,
  HowcodeServerWsServerMessage,
} from '../../shared/howcode-server-ws'

export type HowcodeServerConfig = {
  host: string
  port: number
  authToken: string
  webRoot?: string | null
}

export type HowcodeServerHandle = {
  address: {
    host: string
    port: number
  }
  authToken: string
  close: Effect.Effect<void, HowcodeServerError>
}

export class HowcodeServerError extends Data.TaggedError('HowcodeServerError')<{
  message: string
  cause?: unknown
}> {}

const leadingSlashesPattern = /^\/+/

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function sendFile(response: ServerResponse, filePath: string) {
  response.statusCode = 200
  response.setHeader(
    'content-type',
    contentTypes[path.extname(filePath)] ?? 'application/octet-stream',
  )
  createReadStream(filePath).pipe(response)
}

function resolveStaticFile(webRoot: string, requestPath: string) {
  const decodedPath = decodeURIComponent(requestPath)
  const relativePath =
    decodedPath === '/' ? 'index.html' : decodedPath.replace(leadingSlashesPattern, '')
  const candidatePath = path.resolve(webRoot, relativePath)
  const resolvedRoot = path.resolve(webRoot)
  if (!(candidatePath === resolvedRoot || candidatePath.startsWith(`${resolvedRoot}${path.sep}`))) {
    return null
  }
  if (existsSync(candidatePath) && statSync(candidatePath).isFile()) {
    return candidatePath
  }
  const fallbackPath = path.join(resolvedRoot, 'index.html')
  return existsSync(fallbackPath) ? fallbackPath : null
}

function handleStaticWeb(
  config: HowcodeServerConfig,
  request: IncomingMessage,
  response: ServerResponse,
) {
  if (request.method !== 'GET' || !config.webRoot) return false
  const requestUrl = new URL(request.url ?? '/', 'http://howcode.local')
  if (requestUrl.pathname.startsWith('/api/') || requestUrl.pathname === '/healthz') return false
  const filePath = resolveStaticFile(config.webRoot, requestUrl.pathname)
  if (!filePath) return false
  sendFile(response, filePath)
  return true
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

function isMatchingToken(candidate: string, expectedToken: string) {
  const candidateBuffer = Buffer.from(candidate)
  const expectedBuffer = Buffer.from(expectedToken)
  return (
    expectedToken.length > 0 &&
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  )
}

function hasValidAuthToken(request: IncomingMessage, expectedToken: string) {
  const header = request.headers.authorization
  const prefix = 'Bearer '
  return header?.startsWith(prefix)
    ? isMatchingToken(header.slice(prefix.length), expectedToken)
    : false
}

function readJsonBody(request: IncomingMessage) {
  return Effect.tryPromise({
    try: async () => {
      const chunks: Buffer[] = []
      for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }
      if (chunks.length === 0) {
        return {}
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
    },
    catch: (cause) =>
      new HowcodeServerError({
        message: 'Failed to read request body.',
        cause,
      }),
  })
}

function installWebSocketEvents(
  server: Server,
  config: HowcodeServerConfig,
  transport: AppTransport,
) {
  const webSocketServer = new WebSocketServer({ noServer: true })
  const clients = new Set<Parameters<Parameters<typeof webSocketServer.on>[1]>[0]>()

  server.on('upgrade', (request, socket, head) => {
    const requestUrl = new URL(request.url ?? '/', 'http://howcode.local')
    if (requestUrl.pathname !== HOWCODE_SERVER_WS_PATH) {
      return
    }

    const token = requestUrl.searchParams.get('token')
    if (
      !(token
        ? isMatchingToken(token, config.authToken)
        : hasValidAuthToken(request, config.authToken))
    ) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      webSocketServer.emit('connection', webSocket, request)
    })
  })

  webSocketServer.on('connection', (webSocket) => {
    clients.add(webSocket)
    webSocket.on('close', () => clients.delete(webSocket))
    const subscriptions = new Map<DesktopEventChannel, () => void>()

    webSocket.on('message', (data) => {
      let message: HowcodeServerWsClientMessage
      try {
        message = JSON.parse(data.toString()) as HowcodeServerWsClientMessage
      } catch {
        return
      }

      if (message.channel !== 'desktopEvent' && message.channel !== 'terminalEvent') {
        return
      }

      if (message.type === 'unsubscribe') {
        subscriptions.get(message.channel)?.()
        subscriptions.delete(message.channel)
        return
      }

      if (message.type !== 'subscribe' || subscriptions.has(message.channel)) {
        return
      }

      const unsubscribe = transport.subscribe(message.channel, (event) => {
        if (webSocket.readyState !== webSocket.OPEN) {
          return
        }
        const payload: HowcodeServerWsServerMessage = {
          type: 'event',
          channel: message.channel,
          event,
        }
        webSocket.send(JSON.stringify(payload))
      })
      subscriptions.set(message.channel, unsubscribe)
    })

    webSocket.on('close', () => {
      for (const unsubscribe of subscriptions.values()) {
        unsubscribe()
      }
      subscriptions.clear()
    })
  })

  return () => {
    for (const client of clients) {
      client.terminate()
    }
    webSocketServer.close()
  }
}

function handleRequest(
  config: HowcodeServerConfig,
  transport: AppTransport,
  request: IncomingMessage,
  response: ServerResponse,
) {
  const requestUrl = new URL(request.url ?? '/', 'http://howcode.local')

  if (request.method === 'GET' && requestUrl.pathname === '/healthz') {
    sendJson(response, 200, { ok: true })
    return
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/web/config' && config.webRoot) {
    sendJson(response, 200, { authToken: config.authToken })
    return
  }

  if (request.method === 'GET' && requestUrl.pathname === HOWCODE_SERVER_DESCRIPTOR_PATH) {
    sendJson(response, 200, howcodeServerDescriptor)
    return
  }

  if (request.method === 'POST' && requestUrl.pathname.startsWith(HOWCODE_SERVER_REQUEST_PREFIX)) {
    if (!hasValidAuthToken(request, config.authToken)) {
      sendJson(response, 401, { error: 'Unauthorized.' })
      return
    }
    const channel = requestUrl.pathname.slice(
      HOWCODE_SERVER_REQUEST_PREFIX.length,
    ) as DesktopRequestChannel

    void Effect.runPromise(
      readJsonBody(request).pipe(
        Effect.flatMap((params) =>
          Effect.tryPromise({
            try: () =>
              transport.request(
                channel,
                params as DesktopRequestMap[typeof channel]['params'],
              ) as Promise<unknown>,
            catch: (cause) =>
              new HowcodeServerError({
                message: `Howcode server request failed: ${channel}`,
                cause,
              }),
          }),
        ),
      ),
    ).then(
      (result) => sendJson(response, 200, result ?? null),
      (error: unknown) => {
        console.error('Howcode server request failed', error)
        const message = error instanceof Error ? error.message : 'Howcode server request failed.'
        const cause =
          typeof error === 'object' && error !== null && 'cause' in error ? error.cause : undefined
        sendJson(response, 500, {
          error: message,
          cause: cause instanceof Error ? cause.message : undefined,
        })
      },
    )
    return
  }

  if (handleStaticWeb(config, request, response)) {
    return
  }

  sendJson(response, 404, { error: 'Not found.' })
}

function closeServer(server: Server) {
  return Effect.callback<void, HowcodeServerError>((resume) => {
    server.close((cause) => {
      if (cause) {
        resume(
          Effect.fail(
            new HowcodeServerError({
              message: 'Failed to close Howcode server.',
              cause,
            }),
          ),
        )
        return
      }
      resume(Effect.void)
    })
  })
}

export function startHowcodeServer(config: HowcodeServerConfig, transport: AppTransport) {
  return Effect.callback<HowcodeServerHandle, HowcodeServerError>((resume) => {
    const server = createServer((request, response) =>
      handleRequest(config, transport, request, response),
    )
    const closeWebSocketServer = installWebSocketEvents(server, config, transport)

    server.once('error', (cause) => {
      resume(
        Effect.fail(
          new HowcodeServerError({
            message: 'Failed to start Howcode server.',
            cause,
          }),
        ),
      )
    })

    server.listen(config.port, config.host, () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : config.port
      resume(
        Effect.succeed({
          address: {
            host: config.host,
            port,
          },
          authToken: config.authToken,
          close: Effect.sync(closeWebSocketServer).pipe(Effect.andThen(closeServer(server))),
        }),
      )
    })
  })
}
