import type { AppTransport } from '../shared/app-transport'
import type {
  DesktopEventChannel,
  DesktopEventMap,
  DesktopRequestChannel,
  DesktopRequestMap,
} from '../shared/desktop-ipc'
import {
  HOWCODE_SERVER_REQUEST_PREFIX,
  HOWCODE_SERVER_WS_PATH,
} from '../shared/howcode-server-contracts'
import type { HowcodeServerWsServerMessage } from '../shared/howcode-server-ws'

export type HowcodeServerTransportConfig = {
  baseUrl: string
  authToken: string
}

function resolveRequestUrl(baseUrl: string, channel: DesktopRequestChannel) {
  return new URL(HOWCODE_SERVER_REQUEST_PREFIX + channel, baseUrl).toString()
}

function resolveWebSocketUrl(baseUrl: string, authToken: string) {
  const url = new URL(HOWCODE_SERVER_WS_PATH, baseUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.searchParams.set('token', authToken)
  return url.toString()
}

async function readErrorMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: unknown } | null
  return typeof payload?.error === 'string' && payload.error.length > 0 ? payload.error : fallback
}

export function createHowcodeServerTransport(config: HowcodeServerTransportConfig): AppTransport {
  return {
    request: async <K extends DesktopRequestChannel>(
      channel: K,
      params: DesktopRequestMap[K]['params'],
    ) => {
      const response = await fetch(resolveRequestUrl(config.baseUrl, channel), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.authToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, `Howcode server request failed: ${channel}`),
        )
      }

      return (await response.json()) as DesktopRequestMap[K]['response']
    },
    subscribe: <K extends DesktopEventChannel>(
      channel: K,
      listener: (event: DesktopEventMap[K]) => void,
    ) => {
      const webSocket = new WebSocket(resolveWebSocketUrl(config.baseUrl, config.authToken))
      const handleOpen = () => {
        webSocket.send(JSON.stringify({ type: 'subscribe', channel }))
      }
      const handleMessage = (message: MessageEvent) => {
        const payload = JSON.parse(String(message.data)) as HowcodeServerWsServerMessage<K>
        if (payload.type === 'event' && payload.channel === channel) {
          listener(payload.event)
        }
      }
      webSocket.addEventListener('open', handleOpen)
      webSocket.addEventListener('message', handleMessage)
      return () => {
        webSocket.removeEventListener('open', handleOpen)
        webSocket.removeEventListener('message', handleMessage)
        if (webSocket.readyState === WebSocket.OPEN) {
          webSocket.send(JSON.stringify({ type: 'unsubscribe', channel }))
        }
        webSocket.close()
      }
    },
  }
}
