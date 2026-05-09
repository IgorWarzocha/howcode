import type { Server } from 'node:http'
import { Effect, Fiber, Layer, Queue, Stream } from 'effect'
import * as RpcSerialization from 'effect/unstable/rpc/RpcSerialization'
import * as RpcServer from 'effect/unstable/rpc/RpcServer'
import * as Socket from 'effect/unstable/socket/Socket'
import { type Address, SocketServer } from 'effect/unstable/socket/SocketServer'
import { type WebSocket, WebSocketServer } from 'ws'
import type { AppTransport } from '../shared/app-transport'
import type {
  DesktopEventChannel,
  DesktopEventMap,
  DesktopRequestChannel,
  DesktopRequestMap,
} from '../shared/desktop-ipc'
import {
  type HowcodeRpcEventEnvelope,
  HowcodeRpcGroup,
  HowcodeRpcRequestError,
} from '../shared/howcode-rpc'

export function createHowcodeRpcLayer(transport: AppTransport) {
  return HowcodeRpcGroup.toLayer({
    'app.request': ({ channel, params }) =>
      Effect.tryPromise({
        try: () =>
          transport.request(
            channel as DesktopRequestChannel,
            params as DesktopRequestMap[DesktopRequestChannel]['params'],
          ),
        catch: (cause) =>
          new HowcodeRpcRequestError({
            channel,
            message: cause instanceof Error ? cause.message : 'Howcode RPC request failed.',
          }),
      }),
    'events.subscribe': ({ channel }) =>
      Stream.callback<HowcodeRpcEventEnvelope>((queue) =>
        Effect.acquireRelease(
          Effect.sync(() =>
            transport.subscribe(
              channel as DesktopEventChannel,
              (event: DesktopEventMap[DesktopEventChannel]) => {
                Queue.offerUnsafe(queue, {
                  channel,
                  event,
                })
              },
            ),
          ),
          (unsubscribe) => Effect.sync(unsubscribe),
        ),
      ),
  })
}

type EffectSocketMessageHandler = (data: string | Uint8Array) => unknown

function handleEffectRpcSocketMessage(
  data: WebSocket.RawData,
  handler: EffectSocketMessageHandler,
) {
  if (isRawRpcRequest(data)) return
  const payload = Array.isArray(data) ? Buffer.concat(data) : data
  const result = handler(typeof payload === 'string' ? payload : new Uint8Array(payload))
  if (Effect.isEffect(result)) void Effect.runFork(result as Effect.Effect<unknown, unknown>)
}

function makeWsSocket(webSocket: WebSocket): Socket.Socket {
  return Socket.make({
    runRaw: (handler, options) =>
      Effect.callback<void, Socket.SocketError>((resume) => {
        const onMessage = (data: WebSocket.RawData) => handleEffectRpcSocketMessage(data, handler)
        const onClose = () => {
          cleanup()
          resume(Effect.void)
        }
        const onError = (cause: unknown) => {
          cleanup()
          resume(
            Effect.fail(
              new Socket.SocketError({
                reason: new Socket.SocketReadError({ cause }),
              }),
            ),
          )
        }
        const cleanup = () => {
          webSocket.off('message', onMessage)
          webSocket.off('close', onClose)
          webSocket.off('error', onError)
        }
        webSocket.on('message', onMessage)
        webSocket.once('close', onClose)
        webSocket.once('error', onError)
        if (options?.onOpen) void Effect.runPromise(options.onOpen)
      }),
    writer: Effect.succeed((chunk) =>
      Effect.callback<void, Socket.SocketError>((resume) => {
        if (Socket.isCloseEvent(chunk)) {
          webSocket.close(chunk.code, chunk.reason)
          resume(Effect.void)
          return
        }
        webSocket.send(chunk, (cause) => {
          resume(
            cause
              ? Effect.fail(
                  new Socket.SocketError({
                    reason: new Socket.SocketWriteError({ cause }),
                  }),
                )
              : Effect.void,
          )
        })
      }),
    ),
  })
}

function createWebSocketSocketServerLayer(queue: Queue.Queue<Socket.Socket>) {
  const address = { hostname: '127.0.0.1', port: 0 } as Address
  Object.defineProperty(address, '_tag', { value: 'TcpAddress' })
  return Layer.succeed(SocketServer, {
    address,
    run: (handler) =>
      Effect.forever(
        Queue.take(queue).pipe(Effect.flatMap((socket) => handler(socket))),
      ) as Effect.Effect<never, never, never>,
  })
}

function isRawRpcRequest(data: WebSocket.RawData) {
  try {
    const message = JSON.parse(data.toString()) as { type?: unknown }
    return message.type === 'app.request'
  } catch {
    return false
  }
}

function installRawRpcCompatibilityHandler(webSocket: WebSocket, transport: AppTransport) {
  webSocket.on('message', (data) => {
    void (async () => {
      let message: { id?: unknown; type?: unknown; channel?: unknown; params?: unknown }
      try {
        message = JSON.parse(data.toString())
      } catch {
        return
      }
      if (message.type !== 'app.request' || typeof message.id !== 'string') return
      try {
        const result = await transport.request(
          message.channel as DesktopRequestChannel,
          message.params as DesktopRequestMap[DesktopRequestChannel]['params'],
        )
        webSocket.send(JSON.stringify({ id: message.id, ok: true, result }))
      } catch (error) {
        webSocket.send(
          JSON.stringify({
            id: message.id,
            ok: false,
            error: error instanceof Error ? error.message : 'Howcode RPC request failed.',
          }),
        )
      }
    })()
  })
}

function installRawRpcEventHandler(webSocket: WebSocket, transport: AppTransport) {
  const unsubscribers = new Map<string, () => void>()
  webSocket.on('close', () => {
    for (const unsubscribe of unsubscribers.values()) unsubscribe()
    unsubscribers.clear()
  })
  webSocket.on('message', (data) => {
    void (async () => {
      let message: { id?: unknown; type?: unknown; channel?: unknown }
      try {
        message = JSON.parse(data.toString())
      } catch {
        return
      }
      if (message.type !== 'events.subscribe') return
      if (typeof message.id !== 'string') return
      const channel = message.channel as DesktopEventChannel
      unsubscribers.get(message.id)?.()
      const unsubscribe = transport.subscribe(
        channel,
        (event: DesktopEventMap[DesktopEventChannel]) => {
          webSocket.send(JSON.stringify({ id: message.id, channel, event, type: 'event' }))
        },
      )
      unsubscribers.set(message.id, unsubscribe)
      webSocket.send(JSON.stringify({ id: message.id, ok: true, type: 'subscribed' }))
    })()
  })
}

export function installHowcodeRpcWebSocketServer(options: {
  server: Server
  path: string
  transport: AppTransport
  isAuthorized: (request: import('node:http').IncomingMessage) => boolean
}) {
  const webSocketServer = new WebSocketServer({ noServer: true })
  const queue = Effect.runSync(Queue.unbounded<Socket.Socket>())
  const layer = RpcServer.layer(HowcodeRpcGroup).pipe(
    Layer.provide(createHowcodeRpcLayer(options.transport)),
    Layer.provide(RpcServer.layerProtocolSocketServer),
    Layer.provide(createWebSocketSocketServerLayer(queue)),
    Layer.provide(RpcSerialization.layerJson),
  )
  const fiber = Effect.runFork(Layer.launch(layer))

  options.server.on('upgrade', (request, networkSocket, head) => {
    const requestUrl = new URL(request.url ?? '/', 'http://howcode.local')
    if (requestUrl.pathname !== options.path) return
    if (!options.isAuthorized(request)) {
      networkSocket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      networkSocket.destroy()
      return
    }
    webSocketServer.handleUpgrade(request, networkSocket, head, (webSocket) => {
      installRawRpcCompatibilityHandler(webSocket, options.transport)
      installRawRpcEventHandler(webSocket, options.transport)
      Queue.offerUnsafe(queue, makeWsSocket(webSocket))
    })
  })

  return () => {
    for (const client of webSocketServer.clients) client.close(1000)
    webSocketServer.close()
    Effect.runFork(Fiber.interrupt(fiber))
  }
}
