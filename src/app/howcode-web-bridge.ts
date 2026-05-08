import type { AppTransport } from '../../shared/app-transport'
import type {
  DesktopEventChannel,
  DesktopEventMap,
  DesktopRequestChannel,
  DesktopRequestMap,
} from '../../shared/desktop-ipc'
import {
  HOWCODE_SERVER_REQUEST_PREFIX,
  HOWCODE_SERVER_WS_PATH,
} from '../../shared/howcode-server-contracts'
import type { HowcodeServerWsServerMessage } from '../../shared/howcode-server-ws'
import { createDesktopApiFromTransport } from './desktop/create-desktop-api-from-transport'

type WebConfig = {
  authToken: string
  baseUrl?: string
}

let configPromise: Promise<WebConfig> | null = null

function getWebConfig() {
  configPromise ??= fetch('/api/web/config')
    .then((response) => {
      if (!response.ok) throw new Error('Unable to load Howcode web config.')
      return response.json() as Promise<WebConfig>
    })
    .catch((error) => {
      configPromise = null
      throw error
    })
  return configPromise
}

function resolveUrl(baseUrl: string | undefined, path: string) {
  return new URL(path, baseUrl ?? window.location.origin).toString()
}

async function invokeRequest<K extends DesktopRequestChannel>(
  channel: K,
  params: DesktopRequestMap[K]['params'],
) {
  const config = await getWebConfig()
  const response = await fetch(
    resolveUrl(config.baseUrl, HOWCODE_SERVER_REQUEST_PREFIX + channel),
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.authToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(params),
    },
  )

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error ?? `Howcode server request failed: ${channel}`)
  }

  return (await response.json()) as DesktopRequestMap[K]['response']
}

function resolveWebSocketUrl(config: WebConfig) {
  const url = new URL(HOWCODE_SERVER_WS_PATH, config.baseUrl ?? window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.searchParams.set('token', config.authToken)
  return url.toString()
}

function subscribeToEvent<K extends DesktopEventChannel>(
  channel: K,
  listener: (event: DesktopEventMap[K]) => void,
) {
  let webSocket: WebSocket | null = null
  let closed = false

  void getWebConfig().then((config) => {
    if (closed) return
    webSocket = new WebSocket(resolveWebSocketUrl(config))
    webSocket.addEventListener('open', () => {
      webSocket?.send(JSON.stringify({ type: 'subscribe', channel }))
    })
    webSocket.addEventListener('message', (message) => {
      const payload = JSON.parse(String(message.data)) as HowcodeServerWsServerMessage<K>
      if (payload.type === 'event' && payload.channel === channel) listener(payload.event)
    })
  })

  return () => {
    closed = true
    if (webSocket?.readyState === WebSocket.OPEN) {
      webSocket.send(JSON.stringify({ type: 'unsubscribe', channel }))
    }
    webSocket?.close()
  }
}

const webTransport: AppTransport = {
  request: invokeRequest,
  subscribe: subscribeToEvent,
}

export function installHowcodeWebBridge() {
  if (window.piDesktop) return
  window.piDesktop = createDesktopApiFromTransport(webTransport)
}
