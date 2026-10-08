import type { ActionHandlerResult } from '../../../../desktop/app-service/action-router-result.ts'
import {
  handledAction,
  unhandledAction,
} from '../../../../desktop/app-service/action-router-result.ts'
import { refreshShellIndex } from '../../../../desktop/app-service/shell-loader.ts'
import { loadAppSettings } from '../../../../desktop/app-settings/readers.ts'
import { deleteChatRecordsByConversationIds } from '../../../../desktop/chat-repository.ts'
import { publishComposerState } from '../../../../desktop/conversation-runtime.ts'
import { abortRuntimeConversation } from '../../../../desktop/durable-runtime/host.ts'
import {
  getComposerRequest,
  getDirectoryId,
  getDirectoryIds,
  getDirectoryName,
} from '../../../../shared/desktop-action-payloads.ts'
import type { DesktopAction } from '../../../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload } from '../../../../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../../../../shared/desktop-working-directory.ts'
import { getOriginUrl } from '../../../git/service/index.ts'
import type { WorkingDirectoryPeers } from '../dependencies.ts'
import {
  addDirectoryFromPath,
  createDirectory,
  createDirectoryFromGitHubUrl,
} from '../directory-create.ts'
import { importDirectories, scanKnownDirectories } from '../directory-import.ts'
import { removeFullCleanDirectoryDirectories } from '../directory-worktrees/full-clean-removal.ts'
import {
  archiveDirectoryChats,
  collapseAllDirectories,
  deleteDirectory,
  getDirectoryWorktree,
  hasDirectory,
  hasRetainedDirectoryFamilyConversations,
  hasRunningDirectoryChat,
  listDirectoryFamilyConversationIds,
  listDirectoryFamilyDirectoryIds,
  renameDirectory,
  setDirectoryCollapsed,
  setDirectoryRepoOrigin,
  toggleDirectoryPinned,
} from '../state.ts'
import { resolveDirectoryImportActionResult } from './directory-import-action.ts'
import { isProtectedDirectoryDeletionTarget } from './directory-paths.ts'

export function createDirectoryActionHandler(peers: WorkingDirectoryPeers) {
  const { deleteArtifactsForConversations, listTerminals } = peers
  async function deleteDirectoryConversations(directoryId: string, conversationIds: string[]) {
    const results = await Promise.allSettled(conversationIds.map(abortRuntimeConversation))
    const deletedConversationIds = conversationIds.filter(
      (_id, index) => results[index]?.status === 'fulfilled',
    )
    const failedConversationIds = conversationIds.filter((conversationId, index) => {
      const result = results[index]
      if (result?.status !== 'rejected') return false
      console.warn(
        `Failed to stop conversation for ${directoryId}: ${conversationId}`,
        result.reason,
      )
      return true
    })
    return { deletedConversationIds, failedConversationIds }
  }

  async function isBusyDirectoryDeletionTarget(directoryIds: string[]) {
    if (directoryIds.some((directoryId) => hasRunningDirectoryChat(directoryId))) return true

    const terminalSnapshots = await listTerminals()
    const directoryIdSet = new Set(directoryIds)
    return terminalSnapshots.some(
      (snapshot) =>
        directoryIdSet.has(snapshot.directoryId) &&
        (snapshot.status === 'starting' || snapshot.status === 'running'),
    )
  }

  async function createDirectoryFromPayload(payload: AnyDesktopActionPayload) {
    const appSettings = loadAppSettings()
    const repoUrl = typeof payload.repoUrl === 'string' ? payload.repoUrl.trim() : ''
    const directoryPath =
      typeof payload.directoryPath === 'string' ? payload.directoryPath.trim() : ''
    const parentPath = typeof payload.parentPath === 'string' ? payload.parentPath.trim() : ''
    if (directoryPath) {
      return await addDirectoryFromPath({
        directoryPath,
        createIfMissing: payload.createIfMissing === true,
        initializeGit: appSettings.initializeGitOnDirectoryCreate,
      })
    }

    return repoUrl
      ? await createDirectoryFromGitHubUrl({
          preferredDirectoryLocation: parentPath || appSettings.preferredDirectoryLocation,
          repositoryUrl: repoUrl,
        })
      : await createDirectory({
          preferredDirectoryLocation: parentPath || appSettings.preferredDirectoryLocation,
          directoryName: getDirectoryName(payload) ?? '',
          initializeGit: appSettings.initializeGitOnDirectoryCreate,
        })
  }

  function getDirectoryDeletionBlockedError(directoryId: string) {
    if (!hasDirectory(directoryId)) return 'Cannot delete a project that is not managed by Pi.'
    return null
  }

  async function getAsyncDirectoryDeletionBlockedError(directoryFamilyIds: string[]) {
    const activeDirectoryId = getDesktopWorkingDirectory()
    for (const familyDirectoryId of directoryFamilyIds) {
      if (!(await isProtectedDirectoryDeletionTarget(familyDirectoryId, activeDirectoryId)))
        continue
      return 'Cannot delete the active shell directory.'
    }

    if (await isBusyDirectoryDeletionTarget(directoryFamilyIds)) {
      return 'Cannot delete a project while Pi or a terminal is still running in it.'
    }

    return null
  }

  async function deleteDirectoryWithFullClean(
    directoryId: string,
    directoryConversationIds: string[],
    directoryFamilyIds: string[],
  ) {
    if (hasRetainedDirectoryFamilyConversations(directoryId)) {
      return handledAction({
        error:
          'Cannot delete this folder: chats in other workspaces still use it. Choose Pi only cleanup to keep their working directories.',
      })
    }
    const directoryWorktree = getDirectoryWorktree(directoryId)
    if (directoryWorktree && !directoryWorktree.isMain) {
      return handledAction({
        error:
          `Full clean was refused for ${directoryId}: this path is a linked worktree. ` +
          'Set "WorkingDirectory deletion cleanup" to "Pi only" in Settings to remove Pi data without deleting this folder.',
      })
    }

    const persistedWorktrees = directoryFamilyIds
      .filter((familyDirectoryId) => familyDirectoryId !== directoryId)
      .map((familyDirectoryId) => ({
        directoryId: familyDirectoryId,
        worktree: getDirectoryWorktree(familyDirectoryId),
      }))
    const missingWorktree = persistedWorktrees.find(({ worktree }) => worktree === null)
    if (missingWorktree) {
      return handledAction({
        error:
          `Full clean was refused for ${missingWorktree.directoryId}: saved worktree ownership is missing. ` +
          'Set "WorkingDirectory deletion cleanup" to "Pi only" in Settings to remove Pi data without deleting this folder.',
      })
    }

    const removal = await removeFullCleanDirectoryDirectories({
      rootDirectoryId: directoryId,
      rootWorktree: directoryWorktree,
      worktrees: persistedWorktrees.flatMap(({ worktree }) => (worktree ? [worktree] : [])),
    })
    if ('error' in removal) return handledAction(removal)

    const cleanupResult = await deleteDirectoryConversations(directoryId, directoryConversationIds)
    deleteArtifactsForConversations(directoryConversationIds)
    for (const familyDirectoryId of directoryFamilyIds) deleteDirectory(familyDirectoryId)
    return cleanupResult.failedConversationIds.length > 0
      ? handledAction({
          didMutate: true,
          error: `Deleted project, but ${cleanupResult.failedConversationIds.length} conversation(s) could not be stopped.`,
        })
      : handledAction()
  }

  async function deleteDirectoryPiOnly(
    directoryId: string,
    directoryConversationIds: string[],
    directoryFamilyIds: string[],
  ) {
    const cleanupResult = await deleteDirectoryConversations(directoryId, directoryConversationIds)
    if (cleanupResult.failedConversationIds.length > 0) {
      deleteArtifactsForConversations(cleanupResult.deletedConversationIds)
      deleteChatRecordsByConversationIds(cleanupResult.deletedConversationIds)

      return handledAction({
        didMutate: cleanupResult.deletedConversationIds.length > 0,
        error:
          `Deleted ${cleanupResult.deletedConversationIds.length} conversation(s), ` +
          `but ${cleanupResult.failedConversationIds.length} could not be removed.`,
      })
    }

    deleteArtifactsForConversations(cleanupResult.deletedConversationIds)
    for (const familyDirectoryId of directoryFamilyIds) deleteDirectory(familyDirectoryId)
    return handledAction()
  }

  async function removeDirectoryFromPayload(payload: AnyDesktopActionPayload) {
    const directoryId = getDirectoryId(payload)
    if (!directoryId) return handledAction()

    const blockedError = getDirectoryDeletionBlockedError(directoryId)
    if (blockedError) return handledAction({ error: blockedError })

    const directoryFamilyIds = listDirectoryFamilyDirectoryIds(directoryId)
    const asyncBlockedError = await getAsyncDirectoryDeletionBlockedError(directoryFamilyIds)
    if (asyncBlockedError) return handledAction({ error: asyncBlockedError })

    const appSettings = loadAppSettings()
    const directoryConversationIds = listDirectoryFamilyConversationIds(directoryId)
    return appSettings.directoryDeletionMode === 'full-clean'
      ? await deleteDirectoryWithFullClean(
          directoryId,
          directoryConversationIds,
          directoryFamilyIds,
        )
      : await deleteDirectoryPiOnly(directoryId, directoryConversationIds, directoryFamilyIds)
  }

  type DirectoryActionHandler = (
    payload: AnyDesktopActionPayload,
  ) => Promise<ActionHandlerResult> | ActionHandlerResult

  const directoryActionHandlers = {
    'directory.add': async (payload) => handledAction(await createDirectoryFromPayload(payload)),
    'directory.select': async (payload) => {
      await publishComposerState(getComposerRequest(payload))
      return handledAction()
    },
    'directory.expand': (payload) => {
      const directoryId = getDirectoryId(payload)
      if (directoryId) setDirectoryCollapsed(directoryId, false)
      return handledAction()
    },
    'directory.collapse': (payload) => {
      const directoryId = getDirectoryId(payload)
      if (directoryId) setDirectoryCollapsed(directoryId, true)
      return handledAction()
    },
    'directory.pin': (payload) => {
      const directoryId = getDirectoryId(payload)
      if (directoryId) toggleDirectoryPinned(directoryId)
      return handledAction()
    },
    'directory.edit-name': (payload) => {
      const directoryId = getDirectoryId(payload)
      const directoryName = getDirectoryName(payload)
      if (directoryId && directoryName) renameDirectory(directoryId, directoryName)
      return handledAction()
    },
    'directory.refresh-repo-origin': async (payload) => {
      const directoryId = getDirectoryId(payload)
      if (!directoryId) return handledAction()
      const originUrl = await getOriginUrl(directoryId)
      setDirectoryRepoOrigin(directoryId, originUrl)
      return handledAction({ directoryId, originUrl })
    },
    'directory.archive-chats': (payload) => {
      const directoryId = getDirectoryId(payload)
      if (directoryId) archiveDirectoryChats(directoryId)
      return handledAction()
    },
    'directory.remove': removeDirectoryFromPayload,
    'chats.collapse-all': () => {
      collapseAllDirectories()
      return handledAction()
    },
    'directories.import.scan': async (payload) =>
      handledAction(
        await resolveDirectoryImportActionResult({
          cwd: getDesktopWorkingDirectory(),
          mode: 'scan',
          directoryIds: getDirectoryIds(payload),
          refreshOptions: { force: true },
          refreshShellIndex,
          runAfterRefresh: async (refreshedDirectoryIds) => ({
            directories: await scanKnownDirectories(refreshedDirectoryIds),
          }),
        }),
      ),
    'directories.import.apply': async (payload) =>
      handledAction(
        await resolveDirectoryImportActionResult({
          cwd: getDesktopWorkingDirectory(),
          mode: 'import',
          directoryIds: getDirectoryIds(payload),
          refreshOptions: { emitRefreshEvent: false, force: true },
          refreshShellIndex,
          runAfterRefresh: importDirectories,
        }),
      ),
  } satisfies Partial<Record<DesktopAction, DirectoryActionHandler>>

  async function handleDirectoryDesktopAction(
    action: DesktopAction,
    payload: AnyDesktopActionPayload,
  ): Promise<ActionHandlerResult> {
    const handlers: Partial<Record<DesktopAction, DirectoryActionHandler>> = directoryActionHandlers
    const handler = handlers[action]
    return handler ? await handler(payload) : unhandledAction()
  }

  return handleDirectoryDesktopAction
}
