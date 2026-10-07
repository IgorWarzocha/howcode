import type { DesktopAction } from '../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload } from '../../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../../shared/desktop-working-directory.ts'
import {
  getComposerRequest,
  getProjectId,
  getProjectIds,
  getProjectName,
} from '../../shared/pi-thread-action-payloads.ts'
import { loadAppSettings } from '../app-settings/readers.ts'
import { deleteArtifactsForConversations } from '../artifact-state-db.ts'
import { deleteRuntimeConversation } from '../durable-runtime/host.ts'
import { selectProjectRuntime } from '../pi-desktop-runtime.ts'
import { addProjectFromPath, createProject, createProjectFromGitHubUrl } from '../project-create.ts'
import { getOriginUrl } from '../project-git/project-state.ts'
import { importProjects, scanKnownProjects } from '../project-import.ts'
import { removeFullCleanProjectDirectories } from '../project-worktrees/full-clean-removal.ts'
import { listTerminals } from '../terminal/runtime.ts'
import {
  archiveProjectThreads,
  collapseAllProjects,
  deleteProject,
  deleteThreadRecordsByConversationIds,
  getProjectWorktree,
  hasProject,
  hasRunningProjectThread,
  listProjectFamilyConversationIds,
  listProjectFamilyProjectIds,
  renameProject,
  setProjectCollapsed,
  setProjectRepoOrigin,
  toggleProjectPinned,
} from '../thread-state-db.ts'
import type { ActionHandlerResult } from './action-router-result.ts'
import { handledAction, unhandledAction } from './action-router-result.ts'
import { resolveProjectImportActionResult } from './project-import-action.ts'
import { isProtectedProjectDeletionTarget } from './project-paths.ts'
import { refreshShellIndex } from './shell-loader.ts'

async function deleteProjectConversations(projectId: string, conversationIds: string[]) {
  const results = await Promise.allSettled(conversationIds.map(deleteRuntimeConversation))
  const deletedConversationIds = conversationIds.filter(
    (_id, index) => results[index]?.status === 'fulfilled',
  )
  const failedConversationIds = conversationIds.filter((conversationId, index) => {
    const result = results[index]
    if (result?.status !== 'rejected') return false
    console.warn(`Failed to stop conversation for ${projectId}: ${conversationId}`, result.reason)
    return true
  })
  return { deletedConversationIds, failedConversationIds }
}

async function isBusyProjectDeletionTarget(projectIds: string[]) {
  if (projectIds.some((projectId) => hasRunningProjectThread(projectId))) return true

  const terminalSnapshots = await listTerminals()
  const projectIdSet = new Set(projectIds)
  return terminalSnapshots.some(
    (snapshot) =>
      projectIdSet.has(snapshot.projectId) &&
      (snapshot.status === 'starting' || snapshot.status === 'running'),
  )
}

async function createProjectFromPayload(payload: AnyDesktopActionPayload) {
  const appSettings = loadAppSettings()
  const repoUrl = typeof payload.repoUrl === 'string' ? payload.repoUrl.trim() : ''
  const projectPath = typeof payload.projectPath === 'string' ? payload.projectPath.trim() : ''
  const parentPath = typeof payload.parentPath === 'string' ? payload.parentPath.trim() : ''
  if (projectPath) {
    return await addProjectFromPath({
      projectPath,
      createIfMissing: payload.createIfMissing === true,
      initializeGit: appSettings.initializeGitOnProjectCreate,
    })
  }

  return repoUrl
    ? await createProjectFromGitHubUrl({
        preferredProjectLocation: parentPath || appSettings.preferredProjectLocation,
        repositoryUrl: repoUrl,
      })
    : await createProject({
        preferredProjectLocation: parentPath || appSettings.preferredProjectLocation,
        projectName: getProjectName(payload) ?? '',
        initializeGit: appSettings.initializeGitOnProjectCreate,
      })
}

function getProjectDeletionBlockedError(projectId: string) {
  if (!hasProject(projectId)) return 'Cannot delete a project that is not managed by Pi.'
  return null
}

async function getAsyncProjectDeletionBlockedError(projectFamilyIds: string[]) {
  const activeProjectId = getDesktopWorkingDirectory()
  for (const familyProjectId of projectFamilyIds) {
    if (!(await isProtectedProjectDeletionTarget(familyProjectId, activeProjectId))) continue
    return 'Cannot delete the active shell project.'
  }

  if (await isBusyProjectDeletionTarget(projectFamilyIds)) {
    return 'Cannot delete a project while Pi or a terminal is still running in it.'
  }

  return null
}

async function deleteProjectWithFullClean(
  projectId: string,
  projectConversationIds: string[],
  projectFamilyIds: string[],
) {
  const projectWorktree = getProjectWorktree(projectId)
  if (projectWorktree && !projectWorktree.isMain) {
    return handledAction({
      error:
        `Full clean was refused for ${projectId}: this path is a linked worktree. ` +
        'Set "Project deletion cleanup" to "Pi only" in Settings to remove Pi data without deleting this folder.',
    })
  }

  const persistedWorktrees = projectFamilyIds
    .filter((familyProjectId) => familyProjectId !== projectId)
    .map((familyProjectId) => ({
      projectId: familyProjectId,
      worktree: getProjectWorktree(familyProjectId),
    }))
  const missingWorktree = persistedWorktrees.find(({ worktree }) => worktree === null)
  if (missingWorktree) {
    return handledAction({
      error:
        `Full clean was refused for ${missingWorktree.projectId}: saved worktree ownership is missing. ` +
        'Set "Project deletion cleanup" to "Pi only" in Settings to remove Pi data without deleting this folder.',
    })
  }

  const removal = await removeFullCleanProjectDirectories({
    rootProjectId: projectId,
    rootWorktree: projectWorktree,
    worktrees: persistedWorktrees.flatMap(({ worktree }) => (worktree ? [worktree] : [])),
  })
  if ('error' in removal) return handledAction(removal)

  const cleanupResult = await deleteProjectConversations(projectId, projectConversationIds)
  deleteArtifactsForConversations(projectConversationIds)
  for (const familyProjectId of projectFamilyIds) deleteProject(familyProjectId)
  return cleanupResult.failedConversationIds.length > 0
    ? handledAction({
        didMutate: true,
        error: `Deleted project, but ${cleanupResult.failedConversationIds.length} conversation(s) could not be stopped.`,
      })
    : handledAction()
}

async function deleteProjectPiOnly(
  projectId: string,
  projectConversationIds: string[],
  projectFamilyIds: string[],
) {
  const cleanupResult = await deleteProjectConversations(projectId, projectConversationIds)
  if (cleanupResult.failedConversationIds.length > 0) {
    deleteArtifactsForConversations(cleanupResult.deletedConversationIds)
    deleteThreadRecordsByConversationIds(cleanupResult.deletedConversationIds)

    return handledAction({
      didMutate: cleanupResult.deletedConversationIds.length > 0,
      error:
        `Deleted ${cleanupResult.deletedConversationIds.length} conversation(s), ` +
        `but ${cleanupResult.failedConversationIds.length} could not be removed.`,
    })
  }

  deleteArtifactsForConversations(cleanupResult.deletedConversationIds)
  for (const familyProjectId of projectFamilyIds) deleteProject(familyProjectId)
  return handledAction()
}

async function removeProjectFromPayload(payload: AnyDesktopActionPayload) {
  const projectId = getProjectId(payload)
  if (!projectId) return handledAction()

  const blockedError = getProjectDeletionBlockedError(projectId)
  if (blockedError) return handledAction({ error: blockedError })

  const projectFamilyIds = listProjectFamilyProjectIds(projectId)
  const asyncBlockedError = await getAsyncProjectDeletionBlockedError(projectFamilyIds)
  if (asyncBlockedError) return handledAction({ error: asyncBlockedError })

  const appSettings = loadAppSettings()
  const projectConversationIds = listProjectFamilyConversationIds(projectId)
  return appSettings.projectDeletionMode === 'full-clean'
    ? await deleteProjectWithFullClean(projectId, projectConversationIds, projectFamilyIds)
    : await deleteProjectPiOnly(projectId, projectConversationIds, projectFamilyIds)
}

type ProjectActionHandler = (
  payload: AnyDesktopActionPayload,
) => Promise<ActionHandlerResult> | ActionHandlerResult

const projectActionHandlers = {
  'project.add': async (payload) => handledAction(await createProjectFromPayload(payload)),
  'project.select': async (payload) => {
    await selectProjectRuntime(getComposerRequest(payload))
    return handledAction()
  },
  'project.expand': (payload) => {
    const projectId = getProjectId(payload)
    if (projectId) setProjectCollapsed(projectId, false)
    return handledAction()
  },
  'project.collapse': (payload) => {
    const projectId = getProjectId(payload)
    if (projectId) setProjectCollapsed(projectId, true)
    return handledAction()
  },
  'project.pin': (payload) => {
    const projectId = getProjectId(payload)
    if (projectId) toggleProjectPinned(projectId)
    return handledAction()
  },
  'project.edit-name': (payload) => {
    const projectId = getProjectId(payload)
    const projectName = getProjectName(payload)
    if (projectId && projectName) renameProject(projectId, projectName)
    return handledAction()
  },
  'project.refresh-repo-origin': async (payload) => {
    const projectId = getProjectId(payload)
    if (!projectId) return handledAction()
    const originUrl = await getOriginUrl(projectId)
    setProjectRepoOrigin(projectId, originUrl)
    return handledAction({ projectId, originUrl })
  },
  'project.archive-threads': (payload) => {
    const projectId = getProjectId(payload)
    if (projectId) archiveProjectThreads(projectId)
    return handledAction()
  },
  'project.remove-project': removeProjectFromPayload,
  'threads.collapse-all': () => {
    collapseAllProjects()
    return handledAction()
  },
  'projects.import.scan': async (payload) =>
    handledAction(
      await resolveProjectImportActionResult({
        cwd: getDesktopWorkingDirectory(),
        mode: 'scan',
        projectIds: getProjectIds(payload),
        refreshOptions: { force: true },
        refreshShellIndex,
        runAfterRefresh: async (refreshedProjectIds) => ({
          projects: await scanKnownProjects(refreshedProjectIds),
        }),
      }),
    ),
  'projects.import.apply': async (payload) =>
    handledAction(
      await resolveProjectImportActionResult({
        cwd: getDesktopWorkingDirectory(),
        mode: 'import',
        projectIds: getProjectIds(payload),
        refreshOptions: { emitRefreshEvent: false, force: true },
        refreshShellIndex,
        runAfterRefresh: importProjects,
      }),
    ),
} satisfies Partial<Record<DesktopAction, ProjectActionHandler>>

export async function handleProjectDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<ActionHandlerResult> {
  const handlers: Partial<Record<DesktopAction, ProjectActionHandler>> = projectActionHandlers
  const handler = handlers[action]
  return handler ? await handler(payload) : unhandledAction()
}
