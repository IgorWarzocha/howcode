import type { Dispatch, SetStateAction } from 'react'
import { useEffect } from 'react'
import { getInboxThreadComposerMode } from '../common/inbox-thread-scope'
import type { AppSettings, ComposerState, InboxThread, ProjectGitState } from '../desktop/types'
import type { WorkspaceState } from '../state/workspace'

type UseComposerGitStateSyncInput = {
  workspaceState: WorkspaceState
  selectedInboxThread: InboxThread | null
  composerProjectId: string
  shellComposerState: ComposerState | null | undefined
  shellAppSettings: AppSettings | null | undefined
  loadComposerState: (request?: {
    projectId?: string | null
    sessionPath?: string | null
    composerMode?: 'chat' | 'code' | null
  }) => Promise<ComposerState | null>
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>
  setComposerState: Dispatch<SetStateAction<ComposerState | null>>
  setProjectGitState: Dispatch<SetStateAction<ProjectGitState | null>>
  setProjectGitLoading: Dispatch<SetStateAction<boolean>>
}

function getComposerStateSyncTarget(input: {
  activeView: WorkspaceState['activeView']
  composerProjectId: string
  inboxComposerMode: 'chat' | 'code'
  inboxProjectId: string | null
  inboxSessionPath: string | null
  selectedSessionPath: string | null
}) {
  if (input.activeView === 'inbox') {
    return {
      composerMode: input.inboxComposerMode,
      projectId: input.inboxProjectId,
      sessionPath: input.inboxSessionPath,
    }
  }

  const sessionPath =
    input.activeView === 'chat' || input.activeView === 'thread' || input.activeView === 'gitops'
      ? input.selectedSessionPath
      : null

  return {
    composerMode: input.activeView === 'chat' ? ('chat' as const) : ('code' as const),
    projectId: input.composerProjectId,
    sessionPath,
  }
}

export function useComposerGitStateSync({
  workspaceState,
  selectedInboxThread,
  composerProjectId,
  shellComposerState,
  shellAppSettings,
  loadComposerState,
  loadProjectGitState,
  setComposerState,
  setProjectGitState,
  setProjectGitLoading,
}: UseComposerGitStateSyncInput) {
  const inboxComposerMode = getInboxThreadComposerMode(selectedInboxThread)
  const inboxProjectId = selectedInboxThread?.projectId ?? null
  const inboxSessionPath = selectedInboxThread?.sessionPath ?? null

  useEffect(() => {
    if (!shellComposerState) {
      return
    }

    setComposerState((current) => current ?? shellComposerState)
  }, [setComposerState, shellComposerState])

  useEffect(() => {
    void shellAppSettings?.chatModel
    void shellAppSettings?.chatThinkingLevel
    void shellAppSettings?.codeModel
    void shellAppSettings?.codeThinkingLevel

    const target = getComposerStateSyncTarget({
      activeView: workspaceState.activeView,
      composerProjectId,
      inboxComposerMode,
      inboxProjectId,
      inboxSessionPath,
      selectedSessionPath: workspaceState.selectedSessionPath,
    })

    if (!target.projectId) {
      return
    }

    let cancelled = false

    const syncComposerState = async () => {
      const nextComposerState = await loadComposerState({
        projectId: target.projectId,
        sessionPath: target.sessionPath,
        composerMode: target.composerMode,
      })

      if (!cancelled && nextComposerState) {
        setComposerState(nextComposerState)
      }
    }

    void syncComposerState()

    return () => {
      cancelled = true
    }
  }, [
    loadComposerState,
    composerProjectId,
    inboxComposerMode,
    inboxProjectId,
    inboxSessionPath,
    setComposerState,
    shellAppSettings?.chatModel,
    shellAppSettings?.chatThinkingLevel,
    shellAppSettings?.codeModel,
    shellAppSettings?.codeThinkingLevel,
    workspaceState.activeView,
    workspaceState.selectedSessionPath,
  ])

  useEffect(() => {
    if (!composerProjectId) {
      setProjectGitState(null)
      setProjectGitLoading(false)
      return
    }

    setProjectGitState(null)
    setProjectGitLoading(true)

    let cancelled = false

    const syncProjectGitState = async () => {
      try {
        const nextProjectGitState = await loadProjectGitState(composerProjectId)
        if (!cancelled) {
          setProjectGitState(nextProjectGitState)
        }
      } finally {
        if (!cancelled) {
          setProjectGitLoading(false)
        }
      }
    }

    void syncProjectGitState()

    return () => {
      cancelled = true
    }
  }, [composerProjectId, loadProjectGitState, setProjectGitLoading, setProjectGitState])

  useEffect(() => {
    if (workspaceState.activeView !== 'gitops' || !composerProjectId) {
      return
    }

    let cancelled = false
    setProjectGitLoading(true)

    void loadProjectGitState(composerProjectId)
      .then((nextProjectGitState) => {
        if (!cancelled) {
          setProjectGitState(nextProjectGitState)
        }
      })
      .catch((error) => {
        console.warn('Failed to refresh project git state for the diff panel.', error)
      })
      .finally(() => {
        if (!cancelled) {
          setProjectGitLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    composerProjectId,
    loadProjectGitState,
    setProjectGitLoading,
    setProjectGitState,
    workspaceState.activeView,
  ])
}
