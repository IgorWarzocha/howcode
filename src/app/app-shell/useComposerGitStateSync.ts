import type { Dispatch, SetStateAction } from 'react'
import { useEffect } from 'react'
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

    const inboxProjectId = selectedInboxThread?.projectId ?? null
    const inboxSessionPath = selectedInboxThread?.sessionPath ?? null
    const composerStateProjectId =
      workspaceState.activeView === 'inbox' ? inboxProjectId : composerProjectId
    const composerStateSessionPath =
      workspaceState.activeView === 'chat' ||
      workspaceState.activeView === 'thread' ||
      workspaceState.activeView === 'gitops'
        ? workspaceState.selectedSessionPath
        : workspaceState.activeView === 'inbox'
          ? inboxSessionPath
          : null

    if (!composerStateProjectId) {
      return
    }

    let cancelled = false

    const syncComposerState = async () => {
      const nextComposerState = await loadComposerState({
        projectId: composerStateProjectId,
        sessionPath: composerStateSessionPath,
        composerMode: workspaceState.activeView === 'chat' ? 'chat' : 'code',
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
    selectedInboxThread?.projectId,
    selectedInboxThread?.sessionPath,
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
