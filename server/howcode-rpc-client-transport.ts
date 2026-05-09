import WebSocket from 'ws'
import type { AppTransport } from '../shared/app-transport'
import type {
  DesktopEventChannel,
  DesktopEventMap,
  DesktopRequestChannel,
  DesktopRequestMap,
} from '../shared/desktop-ipc'
import { HOWCODE_RPC_METHODS, HOWCODE_RPC_WS_PATH } from '../shared/howcode-rpc'
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
  fallbackRequestCount: number
  lastTransport: 'rpc' | 'legacy-http' | null
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
    fallbackRequestCount: 0,
    intentionalClose: false,
    lastError: null,
    lastErrorAt: null,
    nextRetryAt: null,
    lastTransport: null,
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

function requestViaRpcWebSocket<K extends DesktopRequestChannel>(
  config: HowcodeRpcClientTransportConfig,
  channel: K,
  params: DesktopRequestMap[K]['params'],
): Promise<DesktopRequestMap[K]['response']> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID()
    const webSocket = new WebSocket(resolveRpcWebSocketUrl(config.baseUrl, config.authToken))
    const cleanup = () => {
      webSocket.off('open', onOpen)
      webSocket.off('message', onMessage)
      webSocket.off('error', onError)
    }
    const onOpen = () => {
      webSocket.send(
        JSON.stringify({ id: requestId, type: HOWCODE_RPC_METHODS.appRequest, channel, params }),
      )
    }
    const onMessage = (data: WebSocket.RawData) => {
      const message = JSON.parse(data.toString()) as {
        id?: string
        ok?: boolean
        result?: DesktopRequestMap[K]['response']
        error?: string
      }
      if (message.id !== requestId) return
      cleanup()
      webSocket.close(1000)
      if (message.ok) {
        resolve(message.result as DesktopRequestMap[K]['response'])
      } else {
        reject(new Error(message.error ?? 'Howcode RPC request failed.'))
      }
    }
    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }
    webSocket.on('open', onOpen)
    webSocket.on('message', onMessage)
    webSocket.on('error', onError)
  })
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
      lastTransport: 'rpc',
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
      const rpcRequest = requestViaRpcWebSocket(config, channel, params)
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
        const result = await legacyEventsTransport.request(channel, params)
        status = {
          ...status,
          fallbackRequestCount: status.fallbackRequestCount + 1,
          lastTransport: 'legacy-http',
        }
        return result
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
        status = { ...status, lastTransport: 'legacy-http' }
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
