export { desktopQueryKeys } from './desktop-query-keys'

import { fallbackAppSlashCommands } from '@howcode/shared/composer-slash-commands'
import { browserDesktopBridgeCapabilities } from '@howcode/shared/desktop-bridge-capabilities'

import { getSafeExternalUrl } from '@howcode/shared/external-url'
import type {
  ArchivedChat,
  Chat,
  ChatData,
  ChatSearchResult,
  ComposerAttachment,
  ComposerFilePickerState,
  ComposerSlashCommand,
  ComposerState,
  ComposerStateRequest,
  InboxChat,
  ShellState,
  WorkspaceNavigationState,
} from '../desktop/types'

export function hasDesktopBridgeQuery() {
  return typeof window !== 'undefined' && typeof window.piDesktop?.invokeAction === 'function'
}

export async function listInstalledComponentsQuery() {
  if (!window.piDesktop?.listInstalledComponents)
    throw new Error('The running shell does not yet support live component activation.')
  return window.piDesktop.listInstalledComponents()
}

export async function admitInstalledComponentQuery(
  request: import('../../../shared/installed-component-contracts').InstalledComponentAdmission,
) {
  if (!window.piDesktop?.admitInstalledComponent)
    throw new Error('Component renderer admission bridge is unavailable.')
  return window.piDesktop.admitInstalledComponent(request)
}

export async function loadInstalledComponentQuery(
  reference: import('../../../shared/package-ui-contracts').PackageUiReference,
) {
  if (!window.piDesktop?.loadInstalledComponent)
    throw new Error('Component renderer bridge is unavailable.')
  return window.piDesktop.loadInstalledComponent(reference)
}

export async function requestInstalledPluginQuery<Result>(
  plugin: string,
  method: string,
  payload: unknown,
): Promise<Result> {
  if (!window.piDesktop) throw new Error('Desktop bridge is unavailable.')
  return (await window.piDesktop.pluginRequest(plugin, method, payload)) as Result
}

export function getDesktopBridgeCapabilitiesQuery() {
  if (typeof window === 'undefined') {
    return browserDesktopBridgeCapabilities
  }

  return window.piDesktop?.capabilities ?? browserDesktopBridgeCapabilities
}

export function canUploadComposerFilesQuery() {
  return Boolean(
    getDesktopBridgeCapabilitiesQuery().browserUploads &&
      typeof window !== 'undefined' &&
      window.piDesktop?.uploadComposerFiles,
  )
}

export async function invokeDesktopActionQuery(
  action: import('../desktop/actions').DesktopAction,
  payload: import('../desktop/types').AnyDesktopActionPayload = {},
) {
  return (await window.piDesktop?.invokeAction?.(action, payload)) ?? null
}

export async function getShellStateQuery(): Promise<ShellState | null> {
  return (await window.piDesktop?.getShellState?.()) ?? null
}

export async function getDirectoryChatsQuery(directoryId: string): Promise<Chat[]> {
  return (await window.piDesktop?.getDirectoryChats?.(directoryId)) ?? []
}

export async function getWorkspaceNavigationStateQuery(
  selectedWorkspaceId?: string | null | undefined,
): Promise<WorkspaceNavigationState | null> {
  return (
    (await window.piDesktop?.getWorkspaceNavigationState?.(selectedWorkspaceId ?? null)) ?? null
  )
}

export async function createWorkspaceQuery(name: string): Promise<WorkspaceNavigationState | null> {
  return (await window.piDesktop?.createWorkspace?.(name)) ?? null
}

export async function getInboxChatsQuery(): Promise<InboxChat[]> {
  return (await window.piDesktop?.getInboxChats?.()) ?? []
}

export async function getArchivedChatsQuery(): Promise<ArchivedChat[]> {
  return (await window.piDesktop?.getArchivedChats?.()) ?? []
}

export async function getComposerStateQuery(
  request: ComposerStateRequest = {},
): Promise<ComposerState | null> {
  return (await window.piDesktop?.getComposerState?.(request)) ?? null
}

export async function getComposerSlashCommandsQuery(
  request: ComposerStateRequest = {},
): Promise<ComposerSlashCommand[]> {
  return (await window.piDesktop?.getComposerSlashCommands?.(request)) ?? fallbackAppSlashCommands
}

export async function getComposerSkillsQuery(request: ComposerStateRequest = {}) {
  return (await window.piDesktop?.getComposerSkills?.(request)) ?? []
}

export async function listComposerAttachmentEntriesQuery(
  request: {
    directoryId?: string | null | undefined
    path?: string | null | undefined
    rootPath?: string | null | undefined
  } = {},
): Promise<ComposerFilePickerState | null> {
  return (await window.piDesktop?.listComposerAttachmentEntries?.(request)) ?? null
}

export async function searchComposerAttachmentEntriesQuery(
  request: {
    directoryId?: string | null | undefined
    query?: string | null | undefined
    limit?: number | null | undefined
  } = {},
) {
  return (await window.piDesktop?.searchComposerAttachmentEntries?.(request)) ?? []
}

export async function uploadComposerFilesQuery(files: File[]): Promise<ComposerAttachment[]> {
  if (!canUploadComposerFilesQuery()) {
    return []
  }

  return (await window.piDesktop?.uploadComposerFiles?.(files)) ?? []
}

export function openExternalQuery(url: string): Promise<boolean> {
  const safeUrl = getSafeExternalUrl(url)
  if (!safeUrl) return Promise.resolve(false)
  window.open(safeUrl, '_blank', 'noopener,noreferrer')
  return Promise.resolve(true)
}

export async function getChatQuery(
  conversationId: string,
  historyCompactions = 0,
): Promise<ChatData | null> {
  return (await window.piDesktop?.getChat?.(conversationId, historyCompactions)) ?? null
}

export async function getConversationEntriesQuery(conversationId: string) {
  return (await window.piDesktop?.getConversationEntries?.(conversationId)) ?? null
}

export async function searchChatQuery(
  conversationId: string,
  query: string,
): Promise<ChatSearchResult> {
  return (
    (await window.piDesktop?.searchChat?.(conversationId, query)) ?? {
      matches: [],
      searchedMessageCount: 0,
    }
  )
}

export function subscribeDesktopEvents(
  listener: (event: import('../desktop/types').DesktopEvent) => void,
) {
  return window.piDesktop?.subscribe?.(listener) ?? (() => undefined)
}

export async function watchConversationQuery(conversationId: string | null): Promise<void> {
  await window.piDesktop?.watchConversation?.(conversationId)
}
