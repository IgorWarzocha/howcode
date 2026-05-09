import { Effect, Layer } from 'effect'
import * as RpcClient from 'effect/unstable/rpc/RpcClient'
import * as RpcSerialization from 'effect/unstable/rpc/RpcSerialization'
import * as Socket from 'effect/unstable/socket/Socket'
import type { AppTransport } from '../shared/app-transport'
import type {
  DesktopEventChannel,
  DesktopEventMap,
  DesktopRequestChannel,
  DesktopRequestMap,
} from '../shared/desktop-ipc'
import { HOWCODE_RPC_METHODS, HOWCODE_RPC_WS_PATH, HowcodeRpcGroup } from '../shared/howcode-rpc'
import { createHowcodeServerTransport } from './howcode-server-transport'

type HowcodeRpcClientTransportConfig = {
  baseUrl: string
  authToken: string
}

function resolveRpcWebSocketUrl(baseUrl: string, authToken: string) {
  const url = new URL(HOWCODE_RPC_WS_PATH, baseUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.searchParams.set('token', authToken)
  return url.toString()
}

function createRpcClientEffect(config: HowcodeRpcClientTransportConfig) {
  const socketLayer = Layer.effect(
    Socket.Socket,
    Socket.makeWebSocket(resolveRpcWebSocketUrl(config.baseUrl, config.authToken), {
      closeCodeIsError: (code) => code !== 1000,
    }),
  ).pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal))

  return RpcClient.make(HowcodeRpcGroup, { flatten: true }).pipe(
    Effect.provide(RpcClient.layerProtocolSocket()),
    Effect.provide(socketLayer),
    Effect.provide(RpcSerialization.layerJson),
  )
}

export function createHowcodeRpcClientTransport(
  config: HowcodeRpcClientTransportConfig,
): AppTransport {
  const legacyEventsTransport = createHowcodeServerTransport(config)

  return {
    request: async <K extends DesktopRequestChannel>(
      channel: K,
      params: DesktopRequestMap[K]['params'],
    ): Promise<DesktopRequestMap[K]['response']> => {
      const rpcRequest = Effect.runPromise(
        Effect.scoped(
          createRpcClientEffect(config).pipe(
            Effect.flatMap((client) =>
              (client as unknown as (tag: string, payload: unknown) => Effect.Effect<unknown>)(
                HOWCODE_RPC_METHODS.appRequest,
                { channel, params },
              ),
            ),
          ),
        ),
      )
      try {
        return (await Promise.race([
          rpcRequest,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Howcode RPC request timed out.')), 500),
          ),
        ])) as DesktopRequestMap[K]['response']
      } catch {
        return await legacyEventsTransport.request(channel, params)
      }
    },
    subscribe: <TChannel extends DesktopEventChannel>(
      channel: TChannel,
      listener: (event: DesktopEventMap[TChannel]) => void,
    ) => legacyEventsTransport.subscribe(channel, listener),
  }
}

export const howcodeRpcClientTransportInternals = {
  resolveRpcWebSocketUrl,
}
