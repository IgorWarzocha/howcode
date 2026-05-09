import type { AppTransport } from '../../shared/app-transport'
import type {
  DesktopEventChannel,
  DesktopEventMap,
  DesktopRequestChannel,
  DesktopRequestMap,
} from '../../shared/desktop-ipc'
import { HOWCODE_RPC_METHODS, HOWCODE_RPC_WS_PATH } from '../../shared/howcode-rpc'
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

function resolveRpcWebSocketUrl(config: WebConfig) {
  const url = new URL(HOWCODE_RPC_WS_PATH, config.baseUrl ?? window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.searchParams.set('token', config.authToken)
  return url.toString()
}

async function invokeRequest<K extends DesktopRequestChannel>(
  channel: K,
  params: DesktopRequestMap[K]['params'],
) {
  const config = await getWebConfig()
  return await new Promise<DesktopRequestMap[K]['response']>((resolve, reject) => {
    const requestId = crypto.randomUUID()
    const webSocket = new WebSocket(resolveRpcWebSocketUrl(config))
    const cleanup = () => {
      webSocket.removeEventListener('open', onOpen)
      webSocket.removeEventListener('message', onMessage)
      webSocket.removeEventListener('error', onError)
    }
    const onOpen = () => {
      webSocket.send(
        JSON.stringify({ id: requestId, type: HOWCODE_RPC_METHODS.appRequest, channel, params }),
      )
    }
    const onMessage = (message: MessageEvent) => {
      const payload = JSON.parse(String(message.data)) as {
        id?: string
        ok?: boolean
        result?: DesktopRequestMap[K]['response']
        error?: string
      }
      if (payload.id !== requestId) return
      cleanup()
      webSocket.close(1000)
      if (payload.ok) {
        resolve(payload.result as DesktopRequestMap[K]['response'])
      } else {
        reject(new Error(payload.error ?? `Howcode server request failed: ${channel}`))
      }
    }
    const onError = () => {
      cleanup()
      reject(new Error(`Howcode server request failed: ${channel}`))
    }
    webSocket.addEventListener('open', onOpen)
    webSocket.addEventListener('message', onMessage)
    webSocket.addEventListener('error', onError)
  })
}

function subscribeToEvent<K extends DesktopEventChannel>(
  channel: K,
  listener: (event: DesktopEventMap[K]) => void,
) {
  const subscriptionId = crypto.randomUUID()
  let webSocket: WebSocket | null = null
  let closed = false

  void getWebConfig().then((config) => {
    if (closed) return
    webSocket = new WebSocket(resolveRpcWebSocketUrl(config))
    webSocket.addEventListener('open', () => {
      webSocket?.send(
        JSON.stringify({ id: subscriptionId, type: HOWCODE_RPC_METHODS.eventsSubscribe, channel }),
      )
    })
    webSocket.addEventListener('message', (message) => {
      const payload = JSON.parse(String(message.data)) as {
        id?: string
        type?: string
        event?: DesktopEventMap[K]
      }
      if (payload.id === subscriptionId && payload.type === 'event') {
        listener(payload.event as DesktopEventMap[K])
      }
    })
  })

  return () => {
    closed = true
    webSocket?.close(1000)
  }
}

const webTransport: AppTransport = {
  request: invokeRequest,
  subscribe: subscribeToEvent,
}

export const webDesktopApi = createDesktopApiFromTransport(webTransport)

export function installHowcodeWebBridge() {
  if (window.piDesktop) return
  window.piDesktop = webDesktopApi
}
