import type { DesktopAction } from '../desktop/actions'
import type { ShellState } from '../desktop/types'
import {
  type ActionPayload,
  getPayloadProjectId,
  getPayloadThreadId,
  sortPinnedProjects,
  sortPinnedThreads,
} from './controller-action-utils'

export function getOptimisticallyRenamedShellState(
  currentState: ShellState | null,
  payload: ActionPayload,
) {
  if (!currentState) {
    return null
  }

  const projectId = getPayloadProjectId(payload)
  const projectName = typeof payload.projectName === 'string' ? payload.projectName.trim() : ''

  if (!projectId || projectName.length === 0) {
    return currentState
  }

  return {
    ...currentState,
    projects: currentState.projects.map((project) =>
      project.id === projectId ? { ...project, name: projectName } : project,
    ),
  } satisfies ShellState
}

export function getOptimisticallyPinnedShellState(
  currentState: ShellState | null,
  action: DesktopAction,
  payload: ActionPayload,
) {
  if (!currentState) {
    return null
  }

  if (action === 'thread.pin') {
    const projectId = getPayloadProjectId(payload)
    const threadId = getPayloadThreadId(payload)

    if (!(projectId && threadId)) {
      return currentState
    }

    return {
      ...currentState,
      projects: currentState.projects.map((project) => {
        if (project.id !== projectId) {
          return project
        }

        const nextThreads = sortPinnedThreads(
          project.threads.map((thread) =>
            thread.id === threadId ? { ...thread, pinned: !thread.pinned } : thread,
          ),
        )

        return {
          ...project,
          threads: nextThreads,
        }
      }),
    } satisfies ShellState
  }

  if (action === 'project.pin') {
    const projectId = getPayloadProjectId(payload)

    if (!projectId) {
      return currentState
    }

    return {
      ...currentState,
      projects: sortPinnedProjects(
        currentState.projects.map((project) =>
          project.id === projectId ? { ...project, pinned: !project.pinned } : project,
        ),
      ),
    } satisfies ShellState
  }

  return currentState
}
