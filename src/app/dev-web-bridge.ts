import type { GitRequestMap } from '@howaboua/howcode-git/host/contracts'
import type { TerminalEvent, TerminalOpenRequest } from '@howaboua/howcode-terminal/contracts'
import type { DesktopAction } from '@howcode/shared/desktop-actions'
import { browserDesktopBridgeCapabilities } from '@howcode/shared/desktop-bridge-capabilities'
import type { AnyDesktopActionPayload, DesktopEvent } from '@howcode/shared/desktop-contracts'
import type {
  DesktopEventChannel,
  DesktopEventMap,
  DesktopRequestChannel,
  DesktopRequestMap,
} from '@howcode/shared/desktop-ipc'
import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'
import { DevWebDesktopEventEnvelope, DevWebTerminalEventEnvelope } from './dev-web-event-schema'
import {
  ComposerAttachmentUploadResponseSchema,
  HeadlessAuthStateSchema,
  HeadlessBridgeConfigSchema,
  HeadlessErrorResponseSchema,
} from './dev-web-response-schema'

let bridgeTokenPromise: Promise<string> | null = null
let authPromise: Promise<void> | null = null
let watchedConversationId: string | null = null
const leadingHashPattern = /^#/

async function decodeJsonResponse<A>(
  response: Response,
  schema: Schema.ConstraintDecoder<A>,
  label: string,
) {
  const decoded = Schema.decodeUnknownResult(schema)(await response.json())
  if (Result.isFailure(decoded)) {
    throw new Error(`Invalid ${label} response.`)
  }
  return decoded.success
}

async function readErrorMessage(response: Response) {
  const payload = await response.json().catch(() => null)
  const decoded = Schema.decodeUnknownResult(HeadlessErrorResponseSchema)(payload)
  return Result.isSuccess(decoded) ? decoded.success.error : undefined
}

function getAccessTokenFromLocation() {
  const params = new URLSearchParams(window.location.hash.replace(leadingHashPattern, ''))
  return params.get('token')?.trim() || null
}

function clearAccessTokenFromLocation() {
  if (!window.location.hash.includes('token=')) {
    return
  }

  history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`)
}

async function fetchAuthState() {
  const response = await fetch('/__howcode/auth', { cache: 'no-store' })
  if (!response.ok) {
    throw new Error('Unable to load headless auth state.')
  }

  return decodeJsonResponse(response, HeadlessAuthStateSchema, 'headless auth')
}

async function submitAccessToken(token: string) {
  const response = await fetch('/__howcode/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  if (!response.ok) {
    throw new Error((await readErrorMessage(response)) ?? 'Invalid access token.')
  }
}

async function tryAuthenticateWithLocationToken() {
  const urlToken = getAccessTokenFromLocation()
  if (!urlToken) {
    return null
  }

  try {
    await submitAccessToken(urlToken)
    clearAccessTokenFromLocation()
    return true
  } catch (error) {
    clearAccessTokenFromLocation()
    return error instanceof Error ? error.message : 'Invalid access token.'
  }
}

async function promptForAccessToken(initialError: string | null) {
  let promptError = initialError
  while (true) {
    const token = await showHeadlessAuthPrompt(promptError)
    try {
      await submitAccessToken(token)
      return
    } catch (error) {
      promptError = error instanceof Error ? error.message : 'Invalid access token.'
    }
  }
}

function showHeadlessAuthPrompt(errorMessage: string | null = null) {
  return new Promise<string>((resolve) => {
    const existing = document.querySelector('[data-howcode-headless-auth]')
    existing?.remove()

    const overlay = document.createElement('div')
    overlay.setAttribute('data-howcode-headless-auth', 'true')
    overlay.className = 'headless-auth-shell'

    const panel = document.createElement('form')
    panel.className = 'headless-auth-panel'

    const eyebrow = document.createElement('div')
    eyebrow.className = 'headless-auth-eyebrow'
    eyebrow.textContent = 'Headless access'

    const title = document.createElement('h1')
    title.className = 'headless-auth-title'
    title.textContent = 'Enter token'

    const description = document.createElement('p')
    description.className = 'headless-auth-description'
    description.textContent = 'Use the token printed by the Howcode headless process.'

    const input = document.createElement('input')
    input.className = 'headless-auth-input'
    input.type = 'password'
    input.name = 'token'
    input.autocomplete = 'one-time-code'
    input.placeholder = 'hc_…'

    const error = document.createElement('p')
    error.className = 'headless-auth-error'
    error.hidden = !errorMessage
    error.textContent = errorMessage ?? ''

    const button = document.createElement('button')
    button.className = 'headless-auth-button'
    button.type = 'submit'
    button.textContent = 'Unlock'

    panel.append(eyebrow, title, description, input, error, button)
    overlay.append(panel)
    document.body.append(overlay)

    panel.addEventListener('submit', (event) => {
      event.preventDefault()
      const token = input.value.trim()
      if (!token) {
        error.textContent = 'Paste the access token.'
        error.hidden = false
        return
      }

      overlay.remove()
      resolve(token)
    })

    input.focus()
  })
}

async function ensureAuthenticated() {
  authPromise ??= (async () => {
    const authState = await fetchAuthState()
    if (!authState.required || authState.authenticated) {
      return
    }

    const locationTokenResult = await tryAuthenticateWithLocationToken()
    if (locationTokenResult === true) {
      return
    }

    await promptForAccessToken(locationTokenResult)
  })().catch((error) => {
    authPromise = null
    throw error
  })

  return authPromise
}

function getBridgeToken() {
  bridgeTokenPromise ??= ensureAuthenticated()
    .then(() => fetch('/__howcode/config'))
    .then((response) => {
      if (!response.ok) {
        throw new Error('Unable to load dev:web bridge config.')
      }
      return decodeJsonResponse(response, HeadlessBridgeConfigSchema, 'dev:web bridge config')
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
    throw new Error(
      (await readErrorMessage(response)) ?? `Desktop bridge request failed: ${channel}`,
    )
  }

  return (await response.json()) as DesktopRequestMap[K]['response']
}

async function invokeGitRequest<Method extends keyof GitRequestMap>(
  method: Method,
  payload: GitRequestMap[Method]['params'],
): Promise<GitRequestMap[Method]['response']> {
  return (await invokeRequest('pluginRequest', {
    plugin: '@howaboua/howcode-git',
    method,
    payload,
  })) as GitRequestMap[Method]['response']
}

async function uploadComposerFiles(files: File[]) {
  if (files.length === 0) {
    return []
  }

  const bridgeToken = await getBridgeToken()
  const formData = new FormData()
  for (const file of files) {
    formData.append('files', file, file.name || 'upload')
  }

  const response = await fetch('/__howcode/upload/composer-attachments', {
    method: 'POST',
    headers: {
      'x-howcode-dev-web-bridge-token': bridgeToken,
    },
    body: formData,
  })

  if (!response.ok) {
    throw new Error((await readErrorMessage(response)) ?? 'File upload failed.')
  }

  const payload = await decodeJsonResponse(
    response,
    ComposerAttachmentUploadResponseSchema,
    'composer attachment upload',
  )
  return payload.attachments ?? []
}

type EventSubscription = {
  eventSource: EventSource | null
  listeners: Set<(event: MessageEvent<string>) => void>
  openListeners: Set<() => void>
  retryTimer: ReturnType<typeof setTimeout> | null
  retryDelayMs: number
}

const eventSubscriptions = new Map<DesktopEventChannel, EventSubscription>()

function reconnectClosedEventSubscription(
  channel: DesktopEventChannel,
  subscription: EventSubscription,
) {
  if (
    eventSubscriptions.get(channel) !== subscription ||
    subscription.listeners.size === 0 ||
    subscription.retryTimer !== null
  )
    return
  const delay = subscription.retryDelayMs
  subscription.retryDelayMs = Math.min(delay * 2, 30_000)
  subscription.retryTimer = setTimeout(() => {
    subscription.retryTimer = null
    if (eventSubscriptions.get(channel) === subscription && subscription.listeners.size > 0)
      connectEventSubscription(channel, subscription)
  }, delay)
}

function connectEventSubscription(channel: DesktopEventChannel, subscription: EventSubscription) {
  subscription.eventSource?.close()
  const source = new EventSource(`/__howcode/events/${channel}`)
  subscription.eventSource = source
  for (const listener of subscription.listeners) source.addEventListener(channel, listener)
  for (const listener of subscription.openListeners) source.addEventListener('open', listener)
  source.addEventListener('open', () => {
    subscription.retryDelayMs = 1_000
    if (import.meta.env.DEV && channel === 'desktopEvent') {
      // The replacement dev service has no in-memory conversation subscriptions.
      void invokeRequest('watchConversation', { conversationId: watchedConversationId }).catch(
        (error: unknown) => console.warn('Failed to restore dev conversation watch.', error),
      )
    }
  })
  source.addEventListener('error', () => {
    // Native retry handles dropped streams, but an HTTP 503 can permanently close EventSource.
    if (subscription.eventSource === source && source.readyState === EventSource.CLOSED)
      reconnectClosedEventSubscription(channel, subscription)
  })
}

function getEventSubscription(channel: DesktopEventChannel) {
  const current = eventSubscriptions.get(channel)
  if (current) {
    return current
  }

  const subscription: EventSubscription = {
    eventSource: null,
    listeners: new Set(),
    openListeners: new Set(),
    retryTimer: null,
    retryDelayMs: 1_000,
  }
  eventSubscriptions.set(channel, subscription)
  connectEventSubscription(channel, subscription)
  return subscription
}

function subscribeToEventOpen(channel: DesktopEventChannel, listener: () => void) {
  const subscription = getEventSubscription(channel)
  subscription.openListeners.add(listener)
  subscription.eventSource?.addEventListener('open', listener)
  return () => {
    subscription.openListeners.delete(listener)
    subscription.eventSource?.removeEventListener('open', listener)
  }
}

function subscribeToEvent<K extends DesktopEventChannel>(
  channel: K,
  decode: (
    input: unknown,
  ) => Result.Result<{ readonly channel: K; readonly event: DesktopEventMap[K] }, unknown>,
  listener: (event: DesktopEventMap[K]) => void,
) {
  const subscription = getEventSubscription(channel)
  const wrappedListener = (event: MessageEvent<string>) => {
    let input: unknown
    try {
      input = JSON.parse(event.data)
    } catch (error) {
      console.warn(`Ignored malformed ${channel} event JSON.`, error)
      return
    }
    const decoded = decode(input)
    if (Result.isFailure(decoded)) {
      console.warn(`Ignored invalid ${channel} event.`, decoded.failure)
      return
    }
    listener(decoded.success.event)
  }

  subscription.listeners.add(wrappedListener)
  subscription.eventSource?.addEventListener(channel, wrappedListener)
  return () => {
    subscription.eventSource?.removeEventListener(channel, wrappedListener)
    subscription.listeners.delete(wrappedListener)
    if (subscription.listeners.size === 0 && eventSubscriptions.get(channel) === subscription) {
      if (subscription.retryTimer !== null) clearTimeout(subscription.retryTimer)
      subscription.retryTimer = null
      subscription.eventSource?.close()
      eventSubscriptions.delete(channel)
    }
  }
}

export async function installDevWebDesktopBridge() {
  if (window.piDesktop) {
    return
  }

  window.piDesktop = {
    providerAuth: (request) => invokeRequest('providerAuth', request),
    pluginRequest: (plugin, method, payload) =>
      invokeRequest('pluginRequest', { plugin, method, payload }),
    platform: navigator.platform.toLowerCase().includes('mac') ? 'darwin' : 'browser',
    capabilities: browserDesktopBridgeCapabilities,
    getShellState: () => invokeRequest('getShellState', {}),
    listPackageUis: () => invokeRequest('listPackageUis', {}),
    listInstalledComponents: () => invokeRequest('listInstalledComponents', {}),
    installInstalledComponent: (request) => invokeRequest('installInstalledComponent', request),
    updateInstalledComponent: (request) => invokeRequest('updateInstalledComponent', request),
    removeInstalledComponent: (request) => invokeRequest('removeInstalledComponent', request),
    admitInstalledComponent: (request) => invokeRequest('admitInstalledComponent', request),
    loadInstalledComponent: (reference) => invokeRequest('loadInstalledComponent', reference),
    loadPackageUi: (reference) => invokeRequest('loadPackageUi', reference),
    openPackageUiBinding: (request) => invokeRequest('openPackageUiBinding', request),
    readPackageUiBindingEvents: (request) => invokeRequest('readPackageUiBindingEvents', request),
    operatePackageUiBinding: (request) => invokeRequest('operatePackageUiBinding', request),
    closePackageUiBinding: (request) => invokeRequest('closePackageUiBinding', request),
    getDirectoryGitState: (directoryId: string) =>
      invokeGitRequest('getDirectoryGitState', { directoryId }),
    getDirectoryUsageSummary: (directoryId: string) =>
      invokeRequest('getDirectoryUsageSummary', { directoryId }),
    getDirectoryFavicon: (directoryId: string) =>
      invokeRequest('getDirectoryFavicon', { directoryId }),
    startDirectoryDiffStream: (
      directoryId: string,
      baseline = null,
      streamId: string | null = null,
      includeUntracked = false,
    ) =>
      invokeGitRequest('startDirectoryDiffStream', {
        directoryId,
        baseline,
        streamId,
        includeUntracked,
      }),
    cancelDirectoryDiffStream: (streamId: string) =>
      invokeGitRequest('cancelDirectoryDiffStream', { streamId }),
    getDirectoryDiffStats: (directoryId: string, baseline = null, includeUntracked = false) =>
      invokeGitRequest('getDirectoryDiffStats', { directoryId, baseline, includeUntracked }),
    getDirectoryDiffImagePreview: (request) =>
      invokeGitRequest('getDirectoryDiffImagePreview', request),
    getDirectoryDiffFileContents: (request) =>
      invokeGitRequest('getDirectoryDiffFileContents', request),
    captureDirectoryDiffBaseline: (directoryId: string) =>
      invokeGitRequest('captureDirectoryDiffBaseline', { directoryId }),
    listDirectoryCommits: (directoryId: string, limit: number | null = null) =>
      invokeGitRequest('listDirectoryCommits', { directoryId, limit }),
    searchPiSkills: (request = {}) => invokeRequest('searchPiSkills', request),
    getConfiguredPiSkills: (request = {}) => invokeRequest('getConfiguredPiSkills', request),
    installPiSkill: (request) => invokeRequest('installPiSkill', request),
    removePiSkill: (request) => invokeRequest('removePiSkill', request),
    listDirectoryDirectoryEntries: (request = {}) =>
      invokeRequest('listDirectoryDirectoryEntries', request),
    uploadComposerFiles: (files: File[]) => uploadComposerFiles(files),
    listComposerAttachmentEntries: (request = {}) =>
      invokeRequest('listComposerAttachmentEntries', request),
    searchComposerAttachmentEntries: (request = {}) =>
      invokeRequest('searchComposerAttachmentEntries', request),
    getComposerState: (request = {}) => invokeRequest('getComposerState', request),
    getComposerSlashCommands: (request = {}) => invokeRequest('getComposerSlashCommands', request),
    getComposerSkills: (request = {}) => invokeRequest('getComposerSkills', request),
    getDirectoryChats: (directoryId: string) => invokeRequest('getDirectoryChats', { directoryId }),
    getWorkspaceNavigationState: (selectedWorkspaceId: string | null = null) =>
      invokeRequest('getWorkspaceNavigationState', { selectedWorkspaceId }),
    workspaceLayout: (request) => invokeRequest('workspaceLayout', request),
    createWorkspace: (name: string) => invokeRequest('createWorkspace', { name }),
    getInboxChats: () => invokeRequest('getInboxChats', {}),
    getArchivedChats: () => invokeRequest('getArchivedChats', {}),
    getChat: (conversationId: string, historyCompactions = 0) =>
      invokeRequest('getChat', { conversationId, historyCompactions }),
    getConversationEntries: (conversationId: string) =>
      invokeRequest('getConversationEntries', { conversationId }),
    searchChat: (conversationId: string, query: string) =>
      invokeRequest('searchChat', { conversationId, query }),
    watchConversation: async (conversationId: string | null) => {
      watchedConversationId = conversationId
      await invokeRequest('watchConversation', { conversationId })
    },
    invokeAction: (action: DesktopAction, payload: AnyDesktopActionPayload = {}) =>
      invokeRequest('invokeAction', { action, payload }),
    listTerminals: () => invokeRequest('listTerminals', {}),
    openTerminal: (request: TerminalOpenRequest) => invokeRequest('terminalOpen', request),
    writeTerminal: async (sessionId: string, data: string) => {
      await invokeRequest('terminalWrite', { sessionId, data })
    },
    resizeTerminal: async (request) => {
      await invokeRequest('terminalResize', request)
    },
    closeTerminal: async (request) => {
      await invokeRequest('terminalClose', request)
    },
    getTerminalStatus: (sessionId: string) => invokeRequest('terminalStatus', { sessionId }),
    subscribe: (listener: (event: DesktopEvent) => void) => {
      const unsubscribe = subscribeToEvent(
        'desktopEvent',
        Schema.decodeUnknownResult(DevWebDesktopEventEnvelope),
        listener,
      )
      // SSE does not replay inventory invalidations lost while disconnected.
      const refreshPackageUis = () => {
        listener({ type: 'package-ui-invalidation' })
        if (import.meta.env.DEV) listener({ type: 'shell-state-refresh' })
      }
      const unsubscribeOpen = subscribeToEventOpen('desktopEvent', refreshPackageUis)
      return () => {
        unsubscribeOpen()
        unsubscribe()
      }
    },
    subscribeTerminal: (listener: (event: TerminalEvent) => void) =>
      subscribeToEvent(
        'terminalEvent',
        Schema.decodeUnknownResult(DevWebTerminalEventEnvelope),
        listener,
      ),
  }

  await ensureAuthenticated()
  await getBridgeToken()
}
