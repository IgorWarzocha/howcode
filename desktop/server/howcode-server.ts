import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { Data, Effect } from 'effect'
import type { AppTransport } from '../../shared/app-transport'
import type { DesktopRequestChannel, DesktopRequestMap } from '../../shared/desktop-ipc'
import {
  HOWCODE_SERVER_DESCRIPTOR_PATH,
  HOWCODE_SERVER_REQUEST_PREFIX,
  howcodeServerDescriptor,
} from '../../shared/howcode-server-contracts'

export type HowcodeServerConfig = {
  host: string
  port: number
}

export type HowcodeServerHandle = {
  address: {
    host: string
    port: number
  }
  close: Effect.Effect<void, HowcodeServerError>
}

export class HowcodeServerError extends Data.TaggedError('HowcodeServerError')<{
  message: string
  cause?: unknown
}> {}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
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

function handleRequest(
  transport: AppTransport,
  request: IncomingMessage,
  response: ServerResponse,
) {
  const requestUrl = new URL(request.url ?? '/', 'http://howcode.local')

  if (request.method === 'GET' && requestUrl.pathname === '/healthz') {
    sendJson(response, 200, { ok: true })
    return
  }

  if (request.method === 'GET' && requestUrl.pathname === HOWCODE_SERVER_DESCRIPTOR_PATH) {
    sendJson(response, 200, howcodeServerDescriptor)
    return
  }

  if (request.method === 'POST' && requestUrl.pathname.startsWith(HOWCODE_SERVER_REQUEST_PREFIX)) {
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
        const message = error instanceof Error ? error.message : 'Howcode server request failed.'
        sendJson(response, 500, { error: message })
      },
    )
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
    const server = createServer((request, response) => handleRequest(transport, request, response))

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
          close: closeServer(server),
        }),
      )
    })
  })
}
