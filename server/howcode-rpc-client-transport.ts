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

export type HowcodeRpcClientConnectionStatus = {
  phase: 'idle' | 'connecting' | 'connected' | 'disconnected'
  reconnectPhase: 'idle' | 'attempting' | 'waiting' | 'exhausted'
  attemptCount: number
  reconnectAttemptCount: number
  connectedAt: string | null
  disconnectedAt: string | null
  lastError: string | null
  lastErrorAt: string | null
  nextRetryAt: string | null
  hasConnected: boolean
  intentionalClose: boolean
}

export type HowcodeRpcClientTransport = AppTransport & {
  getStatus: () => HowcodeRpcClientConnectionStatus
  reconnect: () => Promise<void>
  dispose: () => void
}

function createInitialStatus(): HowcodeRpcClientConnectionStatus {
  return {
    attemptCount: 0,
    connectedAt: null,
    disconnectedAt: null,
    hasConnected: false,
    intentionalClose: false,
    lastError: null,
    lastErrorAt: null,
    nextRetryAt: null,
    phase: 'idle',
    reconnectAttemptCount: 0,
    reconnectPhase: 'idle',
  }
}

function nowIso() {
  return new Date().toISOString()
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
): HowcodeRpcClientTransport {
  const legacyEventsTransport = createHowcodeServerTransport(config)
  let status = createInitialStatus()

  const markConnecting = () => {
    status = {
      ...status,
      attemptCount: status.attemptCount + 1,
      intentionalClose: false,
      phase: status.hasConnected ? 'disconnected' : 'connecting',
      reconnectAttemptCount: status.hasConnected
        ? status.reconnectAttemptCount + 1
        : status.reconnectAttemptCount,
      reconnectPhase: status.hasConnected ? 'attempting' : 'idle',
    }
  }
  const markConnected = () => {
    status = {
      ...status,
      connectedAt: nowIso(),
      disconnectedAt: null,
      hasConnected: true,
      lastError: null,
      lastErrorAt: null,
      nextRetryAt: null,
      phase: 'connected',
      reconnectPhase: 'idle',
    }
  }
  const markDisconnected = (error: unknown) => {
    const message = error instanceof Error ? error.message : 'Howcode RPC request failed.'
    status = {
      ...status,
      disconnectedAt: nowIso(),
      lastError: message,
      lastErrorAt: nowIso(),
      nextRetryAt: new Date(Date.now() + 500).toISOString(),
      phase: 'disconnected',
      reconnectPhase: status.hasConnected ? 'waiting' : 'idle',
    }
  }

  return {
    request: async <K extends DesktopRequestChannel>(
      channel: K,
      params: DesktopRequestMap[K]['params'],
    ): Promise<DesktopRequestMap[K]['response']> => {
      markConnecting()
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
        const result = (await Promise.race([
          rpcRequest,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Howcode RPC request timed out.')), 500),
          ),
        ])) as DesktopRequestMap[K]['response']
        markConnected()
        return result
      } catch (error) {
        markDisconnected(error)
        return await legacyEventsTransport.request(channel, params)
      }
    },
    dispose: () => {
      status = {
        ...status,
        disconnectedAt: nowIso(),
        intentionalClose: true,
        phase: 'disconnected',
        reconnectPhase: 'idle',
      }
    },
    getStatus: () => status,
    reconnect: async () => {
      status = {
        ...status,
        intentionalClose: false,
        reconnectAttemptCount: status.reconnectAttemptCount + 1,
        reconnectPhase: 'attempting',
      }
      try {
        await legacyEventsTransport.request('getHowcodeInstanceManifest', {})
        markConnected()
      } catch (error) {
        markDisconnected(error)
        throw error
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
