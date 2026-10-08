import { removeShellDirectoryFamily } from '@howcode/components/working-directories/ui'
import type { QueryClient } from '@tanstack/react-query'
import type { Dispatch } from 'react'
import type { ArchivedChat, DesktopActionResult } from '../../desktop/types'
import { desktopQueryKeys } from '../../query/desktop-query'
import type { WorkspaceAction, WorkspaceState } from '../../state/workspace-model'
import { refreshArchivedChatsIfOpen } from '../controller-action-helpers'
import {
  type ActionPayload,
  getPayloadChatIds,
  getPayloadDirectoryId,
  getPayloadDirectoryIds,
  getResultChatIds,
  isChatList,
} from '../controller-action-utils'

type ChatLifecycleInput = {
  action: string
  contextualPayload: ActionPayload
  actionResult: DesktopActionResult | null
  workspaceState: WorkspaceState
  queryClient: QueryClient
  dispatch: Dispatch<WorkspaceAction>
  loadArchivedChats: () => Promise<ArchivedChat[]>
  loadDirectoryChats: (
    directoryId: string,
    options?: { replaceLocalDraftConversationId?: string | null },
  ) => Promise<unknown>
  refreshShellState: () => Promise<unknown>
  setArchivedChats: (chats: ArchivedChat[]) => void
  invalidateInboxChats: () => Promise<unknown>
}

function getPayloadChatId(payload: ActionPayload) {
  return typeof payload.chatId === 'string' ? payload.chatId : null
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function clearSelectedChatIfIncluded(input: ChatLifecycleInput, chatIds: string[]) {
  const selectedChatId = input.workspaceState.selectedChatId
  if (!(selectedChatId && new Set(chatIds).has(selectedChatId))) return
  input.dispatch({ type: 'clear-chat-selection' })
  input.dispatch({
    type: 'show-view',
    view: input.workspaceState.activeView === 'chat' ? 'chat' : 'directories',
  })
}

async function invalidateDirectoryUsage(input: ChatLifecycleInput, directoryIds: string[]) {
  const uniqueDirectoryIds = [
    ...new Set(directoryIds.filter((directoryId) => directoryId.length > 0)),
  ]
  await Promise.all(
    uniqueDirectoryIds.map((directoryId) =>
      input.queryClient.invalidateQueries({
        queryKey: desktopQueryKeys.directoryUsageSummary(directoryId),
      }),
    ),
  )
}

export async function refreshArchivedIfVisible(input: ChatLifecycleInput) {
  await refreshArchivedChatsIfOpen({
    archivedChatsVisible: input.workspaceState.activeView === 'archived',
    loadArchivedChats: input.loadArchivedChats,
    setArchivedChats: input.setArchivedChats,
  })
}

async function refreshMutatedChatDirectories(input: ChatLifecycleInput) {
  const directoryId = getPayloadDirectoryId(input.contextualPayload)
  if (input.action === 'chat.restore-many' || input.action === 'chat.delete-many') {
    await input.refreshShellState()
    const directoryIds = [...new Set(getPayloadDirectoryIds(input.contextualPayload))]
    if (directoryIds.length > 0)
      await Promise.all(directoryIds.map((id) => input.loadDirectoryChats(id)))
    await invalidateDirectoryUsage(input, directoryIds)
    return
  }
  if (directoryId) await input.loadDirectoryChats(directoryId)
  if (directoryId) await invalidateDirectoryUsage(input, [directoryId])
}

function getDeletedChatIds(input: ChatLifecycleInput) {
  if (input.action === 'chat.delete')
    return [getPayloadChatId(input.contextualPayload)].filter((chatId) => chatId !== null)
  if (input.action !== 'chat.delete-many') return []
  const deletedBatchChatIds = getResultChatIds(input.actionResult?.result?.deletedChatIds)
  return deletedBatchChatIds.length > 0
    ? deletedBatchChatIds
    : getPayloadChatIds(input.contextualPayload)
}

export async function applyArchivedChatPostEffect(input: ChatLifecycleInput) {
  const directoryId = getPayloadDirectoryId(input.contextualPayload)
  const resultAffectedDirectoryIds = Array.isArray(input.actionResult?.result?.affectedDirectoryIds)
    ? input.actionResult.result.affectedDirectoryIds.filter(isString)
    : []
  const affectedDirectoryIds = [
    ...new Set([directoryId, ...resultAffectedDirectoryIds].filter(isString)),
  ]
  if (input.action === 'chat.assign-branch' && affectedDirectoryIds.length > 1) {
    await input.refreshShellState()
  }
  await Promise.all(affectedDirectoryIds.map((id) => input.loadDirectoryChats(id)))
  await invalidateDirectoryUsage(input, affectedDirectoryIds)
  if (input.action === 'chat.archive' || input.action === 'chat.archive-many') {
    await refreshArchivedIfVisible(input)
  }
  const archivedChatIds =
    input.action === 'chat.archive'
      ? [getPayloadChatId(input.contextualPayload)].filter((chatId) => chatId !== null)
      : input.action === 'chat.archive-many'
        ? getPayloadChatIds(input.contextualPayload)
        : []
  clearSelectedChatIfIncluded(input, archivedChatIds)
  await input.invalidateInboxChats()
}

export async function applyRestoreOrDeleteChatPostEffect(input: ChatLifecycleInput) {
  await refreshMutatedChatDirectories(input)
  input.setArchivedChats(await input.loadArchivedChats())
  clearSelectedChatIfIncluded(input, getDeletedChatIds(input))
  await input.invalidateInboxChats()
}

export async function applyChatOpenOrInboxPostEffect(input: ChatLifecycleInput) {
  const directoryId = getPayloadDirectoryId(input.contextualPayload)
  if (directoryId) await input.loadDirectoryChats(directoryId)
  await input.invalidateInboxChats()
}

export async function applyDirectoryArchiveChatsPostEffect(input: ChatLifecycleInput) {
  const directoryId = getPayloadDirectoryId(input.contextualPayload)
  if (directoryId) await input.loadDirectoryChats(directoryId)
  if (directoryId) await invalidateDirectoryUsage(input, [directoryId])
  await input.refreshShellState()
  await refreshArchivedIfVisible(input)
  if (input.contextualPayload.directoryId === input.workspaceState.selectedDirectoryId)
    input.dispatch({ type: 'show-view', view: 'directories' })
  await input.invalidateInboxChats()
}

export async function applyDirectoryRemovePostEffect(
  input: ChatLifecycleInput & { hasActionError: boolean },
) {
  if (input.hasActionError) {
    if (input.actionResult?.result?.didMutate !== true) return
    const directoryId = getPayloadDirectoryId(input.contextualPayload)
    await input.refreshShellState()
    const refreshedChats = directoryId ? await input.loadDirectoryChats(directoryId) : null
    const selectedChatId = input.workspaceState.selectedChatId
    if (
      directoryId === input.workspaceState.selectedDirectoryId &&
      selectedChatId &&
      isChatList(refreshedChats) &&
      !refreshedChats.some((chat) => chat.id === selectedChatId)
    ) {
      input.dispatch({ type: 'show-view', view: 'directories' })
    }
    await refreshArchivedIfVisible(input)
    await input.invalidateInboxChats()
    return
  }

  if (input.contextualPayload.directoryId === input.workspaceState.selectedDirectoryId)
    input.dispatch({ type: 'show-view', view: 'directories' })
  const directoryId = getPayloadDirectoryId(input.contextualPayload)
  if (directoryId) removeShellDirectoryFamily(input.queryClient, directoryId)
  await refreshArchivedIfVisible(input)
  await input.invalidateInboxChats()
}
