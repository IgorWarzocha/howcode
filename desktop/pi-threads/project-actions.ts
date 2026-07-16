import { readdir, rm, unlink } from 'node:fs/promises'
import path from 'node:path'
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
import { selectProjectRuntime } from '../pi-desktop-runtime.ts'
import { addProjectFromPath, createProject, createProjectFromGitHubUrl } from '../project-create.ts'
import { getOriginUrl } from '../project-git/project-state.ts'
import { importProjects, scanKnownProjects } from '../project-import.ts'
import { openPathWithSystem } from '../system-open-path.ts'
import { listTerminals } from '../terminal/manager.ts'
import {
  archiveProjectThreads,
  collapseAllProjects,
  deleteProject,
  deleteThreadRecordsBySessionPaths,
  hasProject,
  hasRunningProjectThread,
  listProjectFamilyProjectIds,
  listProjectFamilySessionPaths,
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

async function unlinkIfPresent(filePath: string) {
  try {
    await unlink(filePath)
  } catch (error) {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error) ||
      error.code !== 'ENOENT'
    ) {
      throw error
    }
  }
}

async function removeDirectoryIfEmpty(directoryPath: string) {
  try {
    const entries = await readdir(directoryPath)
    if (entries.length > 0) {
      return
    }

    await rm(directoryPath)
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error.code === 'ENOENT' || error.code === 'ENOTEMPTY' || error.code === 'ENOTDIR')
    ) {
      return
    }

    throw error
  }
}

async function deleteProjectPiFiles(projectId: string, sessionPaths: string[]) {
  const resolvedProjectId = path.resolve(projectId)
  const removableDirectories = new Set<string>()
  const deletedSessionPaths: string[] = []
  const failedSessionPaths: string[] = []

  const deletionResults = await Promise.all(
    sessionPaths.map(async (sessionPath) => {
      try {
        await unlinkIfPresent(sessionPath)
        return { sessionPath, deleted: true as const }
      } catch (error) {
        console.warn(`Failed to remove Pi session file for ${projectId}: ${sessionPath}`, error)
        return { sessionPath, deleted: false as const }
      }
    }),
  )

  for (const { sessionPath, deleted } of deletionResults) {
    if (!deleted) {
      failedSessionPaths.push(sessionPath)
      continue
    }
    deletedSessionPaths.push(sessionPath)

    let currentDirectory = path.dirname(path.resolve(sessionPath))
    while (currentDirectory.startsWith(`${resolvedProjectId}${path.sep}`)) {
      removableDirectories.add(currentDirectory)
      const parentDirectory = path.dirname(currentDirectory)
      if (parentDirectory === currentDirectory) {
        break
      }
      currentDirectory = parentDirectory
    }
  }

  await [...removableDirectories]
    .sort((left, right) => right.length - left.length)
    .reduce<Promise<void>>(
      (pending, directoryPath) =>
        pending.then(async () => {
          try {
            await removeDirectoryIfEmpty(directoryPath)
          } catch (error) {
            console.warn(
              `Failed to remove empty Pi session directory for ${projectId}: ${directoryPath}`,
              error,
            )
          }
        }),
      Promise.resolve(),
    )

  return {
    deletedSessionPaths,
    failedSessionPaths,
  }
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

function getFullCleanProjectRemovalPaths(projectFamilyIds: string[]) {
  const pathsByResolvedPath = new Map<string, string>()
  for (const projectId of projectFamilyIds) {
    pathsByResolvedPath.set(path.resolve(projectId), projectId)
  }

  return [...pathsByResolvedPath.entries()]
    .sort(([left], [right]) => right.length - left.length)
    .map(([, projectId]) => projectId)
}

async function deleteProjectWithFullClean(
  projectId: string,
  projectSessionPaths: string[],
  projectFamilyIds: string[],
) {
  const cleanupResult = await deleteProjectPiFiles(projectId, projectSessionPaths)
  for (const projectPath of getFullCleanProjectRemovalPaths(projectFamilyIds)) {
    await rm(projectPath, { recursive: true, force: true })
  }
  deleteArtifactsForConversations(projectSessionPaths)
  for (const familyProjectId of projectFamilyIds) deleteProject(familyProjectId)
  return cleanupResult.failedSessionPaths.length > 0
    ? handledAction({
        didMutate: true,
        error: `Deleted project, but ${cleanupResult.failedSessionPaths.length} Pi session file(s) could not be removed.`,
      })
    : handledAction()
}

async function deleteProjectPiOnly(
  projectId: string,
  projectSessionPaths: string[],
  projectFamilyIds: string[],
) {
  const cleanupResult = await deleteProjectPiFiles(projectId, projectSessionPaths)
  if (cleanupResult.failedSessionPaths.length > 0) {
    deleteArtifactsForConversations(cleanupResult.deletedSessionPaths)
    deleteThreadRecordsBySessionPaths(cleanupResult.deletedSessionPaths)

    return handledAction({
      didMutate: cleanupResult.deletedSessionPaths.length > 0,
      error:
        `Deleted ${cleanupResult.deletedSessionPaths.length} Pi session file(s), ` +
        `but ${cleanupResult.failedSessionPaths.length} could not be removed.`,
    })
  }

  deleteArtifactsForConversations(cleanupResult.deletedSessionPaths)
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
  const projectSessionPaths = listProjectFamilySessionPaths(projectId)
  return appSettings.projectDeletionMode === 'full-clean'
    ? await deleteProjectWithFullClean(projectId, projectSessionPaths, projectFamilyIds)
    : await deleteProjectPiOnly(projectId, projectSessionPaths, projectFamilyIds)
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
  'project.open-in-file-manager': async (payload) => {
    const projectId = getProjectId(payload)
    if (!projectId) return handledAction()
    if (!(await openPathWithSystem(projectId))) throw new Error(`Unable to open path: ${projectId}`)
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
