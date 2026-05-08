import type { AppTransport } from '../../shared/app-transport'
import type {
  DesktopEventChannel,
  DesktopEventMap,
  DesktopRequestChannel,
  DesktopRequestMap,
} from '../../shared/desktop-ipc'
import { createDesktopApiFromTransport } from './desktop/create-desktop-api'

let bridgeTokenPromise: Promise<string> | null = null

function getBridgeToken() {
  bridgeTokenPromise ??= fetch('/__howcode/config')
    .then((response) => {
      if (!response.ok) {
        throw new Error('Unable to load dev:web bridge config.')
      }
      return response.json() as Promise<{ bridgeToken?: string }>
    })
    .then((config) => {
      if (!config.bridgeToken) {
        throw new Error('dev:web bridge config did not include a token.')
      }
      return config.bridgeToken
    })
    .catch((error) => {
      bridgeTokenPromise = null
      throw error
    })

  return bridgeTokenPromise
}

async function invokeRequest<K extends DesktopRequestChannel>(
  channel: K,
  params: DesktopRequestMap[K]['params'],
) {
  const bridgeToken = await getBridgeToken()
  const response = await fetch(`/__howcode/request/${channel}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-howcode-dev-web-bridge-token': bridgeToken,
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error ?? `Desktop bridge request failed: ${channel}`)
  }

  return (await response.json()) as DesktopRequestMap[K]['response']
}

type EventSubscription = {
  eventSource: EventSource
  listeners: Set<(event: MessageEvent<string>) => void>
}

const eventSubscriptions = new Map<DesktopEventChannel, EventSubscription>()

function getEventSubscription(channel: DesktopEventChannel) {
  const current = eventSubscriptions.get(channel)
  if (current) {
    return current
  }

  const subscription: EventSubscription = {
    eventSource: new EventSource(`/__howcode/events/${channel}`),
    listeners: new Set(),
  }
  eventSubscriptions.set(channel, subscription)
  return subscription
}

function subscribeToEvent<K extends DesktopEventChannel>(
  channel: K,
  listener: (event: DesktopEventMap[K]) => void,
) {
  const subscription = getEventSubscription(channel)
  const wrappedListener = (event: MessageEvent<string>) => {
    const payload = JSON.parse(event.data) as {
      channel: K
      event: DesktopEventMap[K]
    }
    listener(payload.event)
  }

  subscription.listeners.add(wrappedListener)
  subscription.eventSource.addEventListener(channel, wrappedListener)
  return () => {
    subscription.eventSource.removeEventListener(channel, wrappedListener)
    subscription.listeners.delete(wrappedListener)
    if (subscription.listeners.size === 0) {
      subscription.eventSource.close()
      eventSubscriptions.delete(channel)
    }
  }
}

const devWebTransport: AppTransport = {
  request: invokeRequest,
  subscribe: subscribeToEvent,
}

export function installDevWebDesktopBridge() {
  if (window.piDesktop) {
    return
  }

  window.howcodeDevWebBridge = true
  window.piDesktop = createDesktopApiFromTransport(devWebTransport)
}
