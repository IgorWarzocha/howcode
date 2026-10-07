import type { Dispatch } from 'react'
import { useEffect } from 'react'
import type { ArchivedThread } from '../desktop/types'
import type { CodeThreadSelection, WorkspaceAction, WorkspaceState } from '../state/workspace'
import { resolveCodeThreadSelection } from '../state/workspace-action-handlers'
import type { Project } from '../types'

type UseProjectShellSyncInput = {
  enabled?: boolean
  projects: Project[]
  collapsedProjectIds: Record<string, boolean>
  activeView: WorkspaceState['activeView']
  selectedProjectId: WorkspaceState['selectedProjectId']
  selectedThreadId: WorkspaceState['selectedThreadId']
  selectedConversationId: WorkspaceState['selectedConversationId']
  lastCodeThreadSelection: CodeThreadSelection | null
  loadProjectThreads: (
    projectId: string,
    options?: { chat?: boolean; replaceLocalDraftConversationId?: string | null },
  ) => Promise<unknown>
  loadArchivedThreads: () => Promise<ArchivedThread[]>
  dispatch: Dispatch<WorkspaceAction>
  setArchivedThreads: (threads: ArchivedThread[]) => void
}

export function useProjectShellSync({
  enabled = true,
  projects,
  collapsedProjectIds,
  activeView,
  selectedProjectId,
  selectedThreadId,
  selectedConversationId,
  lastCodeThreadSelection,
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
      !selectedConversationId ||
      projects.some((project) =>
        project.threads.some((thread) => thread.conversationId === selectedConversationId),
      )

    const resolvedLastCodeThreadSelection = resolveCodeThreadSelection(
      projects,
      lastCodeThreadSelection,
    )
    const hasSyncedRememberedCodeThread =
      resolvedLastCodeThreadSelection?.projectId === lastCodeThreadSelection?.projectId &&
      resolvedLastCodeThreadSelection?.threadId === lastCodeThreadSelection?.threadId &&
      resolvedLastCodeThreadSelection?.conversationId === lastCodeThreadSelection?.conversationId

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
    selectedConversationId,
    selectedThreadId,
  ])

  useEffect(() => {
    if (!enabled) return
    const threadsScope = activeView === 'chat' ? 'chat' : 'code'
    const expandedProjects = projects.filter(
      (project) =>
        !collapsedProjectIds[project.id] &&
        (!project.threadsLoaded || project.threadsScope !== threadsScope),
    )

    for (const project of expandedProjects) {
      void loadProjectThreads(project.id, { chat: activeView === 'chat' })
    }
  }, [enabled, activeView, collapsedProjectIds, loadProjectThreads, projects])

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
