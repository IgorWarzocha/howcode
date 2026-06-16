import { isLocalSessionPath } from '@howcode/shared/session-paths'
import type { Dispatch } from 'react'
import { useEffect } from 'react'
import type { ArchivedThread } from '../desktop/types'
import type { CodeThreadSelection, WorkspaceAction, WorkspaceState } from '../state/workspace'
import { resolveCodeThreadSelection } from '../state/workspace-action-handlers'
import type { Project } from '../types'

type UseProjectShellSyncInput = {
  projects: Project[]
  collapsedProjectIds: Record<string, boolean>
  activeView: WorkspaceState['activeView']
  selectedProjectId: WorkspaceState['selectedProjectId']
  selectedThreadId: WorkspaceState['selectedThreadId']
  selectedSessionPath: WorkspaceState['selectedSessionPath']
  lastCodeThreadSelection: CodeThreadSelection | null
  takeoverVisible: WorkspaceState['takeoverVisible']
  loadProjectThreads: (
    projectId: string,
    options?: { chat?: boolean; replaceLocalDraftSessionPath?: string | null },
  ) => Promise<unknown>
  loadArchivedThreads: () => Promise<ArchivedThread[]>
  dispatch: Dispatch<WorkspaceAction>
  setArchivedThreads: (threads: ArchivedThread[]) => void
}

export function useProjectShellSync({
  projects,
  collapsedProjectIds,
  activeView,
  selectedProjectId,
  selectedThreadId,
  selectedSessionPath,
  lastCodeThreadSelection,
  takeoverVisible,
  loadProjectThreads,
  loadArchivedThreads,
  dispatch,
  setArchivedThreads,
}: UseProjectShellSyncInput) {
  useEffect(() => {
    if (projects.length === 0) {
      return
    }

    const hasSelectedProject =
      !selectedProjectId || projects.some((project) => project.id === selectedProjectId)
    const hasSelectedThread =
      !selectedThreadId ||
      projects.some((project) => project.threads.some((thread) => thread.id === selectedThreadId))
    const hasSelectedSession =
      !selectedSessionPath ||
      projects.some((project) =>
        project.threads.some((thread) => thread.sessionPath === selectedSessionPath),
      )

    const resolvedLastCodeThreadSelection = resolveCodeThreadSelection(
      projects,
      lastCodeThreadSelection,
    )
    const hasSyncedRememberedCodeThread =
      resolvedLastCodeThreadSelection?.projectId === lastCodeThreadSelection?.projectId &&
      resolvedLastCodeThreadSelection?.threadId === lastCodeThreadSelection?.threadId &&
      resolvedLastCodeThreadSelection?.sessionPath === lastCodeThreadSelection?.sessionPath

    if (
      hasSelectedProject &&
      hasSelectedThread &&
      hasSelectedSession &&
      hasSyncedRememberedCodeThread
    ) {
      return
    }

    dispatch({ type: 'sync-projects', projects })
  }, [
    dispatch,
    lastCodeThreadSelection,
    projects,
    selectedProjectId,
    selectedSessionPath,
    selectedThreadId,
  ])

  useEffect(() => {
    const threadsScope = activeView === 'chat' ? 'chat' : 'code'
    const expandedProjects = projects.filter(
      (project) =>
        !collapsedProjectIds[project.id] &&
        (!project.threadsLoaded || project.threadsScope !== threadsScope),
    )

    for (const project of expandedProjects) {
      void loadProjectThreads(project.id, { chat: activeView === 'chat' })
    }
  }, [activeView, collapsedProjectIds, loadProjectThreads, projects])

  useEffect(() => {
    if (
      !takeoverVisible ||
      activeView === 'chat' ||
      !selectedProjectId ||
      !isLocalSessionPath(selectedSessionPath)
    ) {
      return
    }

    let cancelled = false
    const pollProjectThreads = () => {
      void loadProjectThreads(selectedProjectId, {
        replaceLocalDraftSessionPath: selectedSessionPath,
      }).finally(() => {
        if (!cancelled) timeoutId = window.setTimeout(pollProjectThreads, 1000)
      })
    }
    let timeoutId = window.setTimeout(pollProjectThreads, 1000)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [activeView, loadProjectThreads, selectedProjectId, selectedSessionPath, takeoverVisible])

  useEffect(() => {
    if (activeView !== 'archived') {
      return
    }

    let cancelled = false

    const syncArchivedThreads = async () => {
      const nextArchivedThreads = await loadArchivedThreads()
      if (!cancelled) {
        setArchivedThreads(nextArchivedThreads)
      }
    }

    void syncArchivedThreads()

    return () => {
      cancelled = true
    }
  }, [activeView, loadArchivedThreads, setArchivedThreads])
}
