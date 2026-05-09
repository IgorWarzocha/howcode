import type { AppTransport } from '../shared/app-transport'
import type {
  DesktopEventChannel,
  DesktopEventMap,
  DesktopRequestChannel,
  DesktopRequestMap,
} from '../shared/desktop-ipc'
import {
  HOWCODE_LEGACY_SERVER_REQUEST_PREFIX,
  HOWCODE_LEGACY_SERVER_WS_PATH,
} from '../shared/howcode-server-contracts'
import type { HowcodeServerWsServerMessage } from '../shared/howcode-server-ws'

export type HowcodeServerTransportConfig = {
  baseUrl: string
  authToken: string
}

const reconnectInitialDelayMs = 500
const reconnectMaxDelayMs = 8_000
const connectionFailurePattern = /fetch failed|ECONNREFUSED|ECONNRESET|socket|network|terminated/i

function resolveRequestUrl(baseUrl: string, channel: DesktopRequestChannel) {
  return new URL(HOWCODE_LEGACY_SERVER_REQUEST_PREFIX + channel, baseUrl).toString()
}

function resolveWebSocketUrl(baseUrl: string, authToken: string) {
  const url = new URL(HOWCODE_LEGACY_SERVER_WS_PATH, baseUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.searchParams.set('token', authToken)
  return url.toString()
}

async function readErrorMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: unknown } | null
  return typeof payload?.error === 'string' && payload.error.length > 0 ? payload.error : fallback
}

function isConnectionFailure(error: unknown) {
  if (!(error instanceof Error)) return false
  return connectionFailurePattern.test(error.message)
}

async function requestWithConnectionRetry<K extends DesktopRequestChannel>(
  config: HowcodeServerTransportConfig,
  channel: K,
  params: DesktopRequestMap[K]['params'],
) {
  const send = async () => {
    const response = await fetch(resolveRequestUrl(config.baseUrl, channel), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.authToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, `Howcode server request failed: ${channel}`))
    }

    return (await response.json()) as DesktopRequestMap[K]['response']
  }

  try {
    return await send()
  } catch (error) {
    if (!isConnectionFailure(error)) throw error
    return await send()
  }
}

function createReconnectingSubscription<K extends DesktopEventChannel>(
  config: HowcodeServerTransportConfig,
  channel: K,
  listener: (event: DesktopEventMap[K]) => void,
) {
  let active = true
  let retryDelayMs = reconnectInitialDelayMs
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let webSocket: WebSocket | null = null

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  const closeSocket = () => {
    const current = webSocket
    webSocket = null
    if (!current) return
    current.removeEventListener('open', handleOpen)
    current.removeEventListener('message', handleMessage)
    current.removeEventListener('close', handleClose)
    current.removeEventListener('error', handleError)
    current.close()
  }

  const scheduleReconnect = () => {
    if (!active || reconnectTimer) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, retryDelayMs)
    retryDelayMs = Math.min(reconnectMaxDelayMs, retryDelayMs * 2)
  }

  const handleOpen = () => {
    retryDelayMs = reconnectInitialDelayMs
    webSocket?.send(JSON.stringify({ type: 'subscribe', channel }))
  }

  const handleMessage = (message: MessageEvent) => {
    const payload = JSON.parse(String(message.data)) as HowcodeServerWsServerMessage<K>
    if (payload.type === 'event' && payload.channel === channel) {
      listener(payload.event)
    }
  }

  const handleClose = () => {
    if (webSocket) {
      webSocket.removeEventListener('open', handleOpen)
      webSocket.removeEventListener('message', handleMessage)
      webSocket.removeEventListener('close', handleClose)
      webSocket.removeEventListener('error', handleError)
      webSocket = null
    }
    scheduleReconnect()
  }

  const handleError = () => {
    scheduleReconnect()
  }

  const connect = () => {
    if (!active) return
    closeSocket()
    webSocket = new WebSocket(resolveWebSocketUrl(config.baseUrl, config.authToken))
    webSocket.addEventListener('open', handleOpen)
    webSocket.addEventListener('message', handleMessage)
    webSocket.addEventListener('close', handleClose)
    webSocket.addEventListener('error', handleError)
  }

  connect()

  return () => {
    active = false
    clearReconnectTimer()
    const current = webSocket
    if (current?.readyState === WebSocket.OPEN) {
      current.send(JSON.stringify({ type: 'unsubscribe', channel }))
    }
    closeSocket()
  }
}

export function createHowcodeServerTransport(config: HowcodeServerTransportConfig): AppTransport {
  return {
    request: async <K extends DesktopRequestChannel>(
      channel: K,
      params: DesktopRequestMap[K]['params'],
    ) => await requestWithConnectionRetry(config, channel, params),
    subscribe: <K extends DesktopEventChannel>(
      channel: K,
      listener: (event: DesktopEventMap[K]) => void,
    ) => createReconnectingSubscription(config, channel, listener),
  }
}
