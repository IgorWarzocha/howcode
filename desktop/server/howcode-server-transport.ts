import type { AppTransport } from '../../shared/app-transport'
import type {
  DesktopEventChannel,
  DesktopEventMap,
  DesktopRequestChannel,
  DesktopRequestMap,
} from '../../shared/desktop-ipc'
import { HOWCODE_SERVER_REQUEST_PREFIX } from '../../shared/howcode-server-contracts'

export type HowcodeServerTransportConfig = {
  baseUrl: string
  authToken: string
}

function resolveRequestUrl(baseUrl: string, channel: DesktopRequestChannel) {
  const url = new URL(HOWCODE_SERVER_REQUEST_PREFIX + channel, baseUrl)
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
      _channel: K,
      _listener: (event: DesktopEventMap[K]) => void,
    ) => {
      throw new Error('Howcode server event transport is not implemented yet.')
    },
  }
}
