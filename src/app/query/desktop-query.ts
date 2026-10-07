export { desktopQueryKeys } from './desktop-query-keys'

import { fallbackAppSlashCommands } from '@howcode/shared/composer-slash-commands'
import { browserDesktopBridgeCapabilities } from '@howcode/shared/desktop-bridge-capabilities'

import { getSafeExternalUrl } from '@howcode/shared/external-url'
import type {
  ArchivedThread,
  ChatSidebarState,
  ComposerAttachment,
  ComposerFilePickerState,
  ComposerSlashCommand,
  ComposerState,
  ComposerStateRequest,
  InboxThread,
  ShellState,
  Thread,
  ThreadData,
  ThreadSearchResult,
} from '../desktop/types'

export function hasDesktopBridgeQuery() {
  return typeof window !== 'undefined' && typeof window.piDesktop?.invokeAction === 'function'
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

export async function getProjectThreadsQuery(projectId: string, chat = false): Promise<Thread[]> {
  return (await window.piDesktop?.getProjectThreads?.(projectId, { chat })) ?? []
}

export async function getChatSidebarStateQuery(
  selectedGroupId?: string | null | undefined,
): Promise<ChatSidebarState | null> {
  return (await window.piDesktop?.getChatSidebarState?.(selectedGroupId ?? null)) ?? null
}

export async function createChatGroupQuery(name: string): Promise<ChatSidebarState | null> {
  return (await window.piDesktop?.createChatGroup?.(name)) ?? null
}

export async function getInboxThreadsQuery(): Promise<InboxThread[]> {
  return (await window.piDesktop?.getInboxThreads?.()) ?? []
}

export async function getArchivedThreadsQuery(): Promise<ArchivedThread[]> {
  return (await window.piDesktop?.getArchivedThreads?.()) ?? []
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
    projectId?: string | null | undefined
    path?: string | null | undefined
    rootPath?: string | null | undefined
  } = {},
): Promise<ComposerFilePickerState | null> {
  return (await window.piDesktop?.listComposerAttachmentEntries?.(request)) ?? null
}

export async function searchComposerAttachmentEntriesQuery(
  request: {
    projectId?: string | null | undefined
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

export async function getThreadQuery(
  conversationId: string,
  historyCompactions = 0,
): Promise<ThreadData | null> {
  return (await window.piDesktop?.getThread?.(conversationId, historyCompactions)) ?? null
}

export async function getConversationEntriesQuery(conversationId: string) {
  return (await window.piDesktop?.getConversationEntries?.(conversationId)) ?? null
}

export async function searchThreadQuery(
  conversationId: string,
  query: string,
): Promise<ThreadSearchResult> {
  return (
    (await window.piDesktop?.searchThread?.(conversationId, query)) ?? {
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
