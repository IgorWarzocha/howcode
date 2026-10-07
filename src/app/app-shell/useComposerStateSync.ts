import type { Dispatch, SetStateAction } from 'react'
import { useEffect } from 'react'
import { getInboxThreadComposerMode } from '../common/inbox-thread-scope'
import type { AppSettings, ComposerState, InboxThread } from '../desktop/types'
import type { WorkspaceState } from '../state/workspace-model'

type UseComposerStateSyncInput = {
  workspaceState: WorkspaceState
  selectedInboxThread: InboxThread | null
  composerProjectId: string
  shellComposerState: ComposerState | null | undefined
  shellAppSettings: AppSettings | null | undefined
  loadComposerState: (request?: {
    projectId?: string | null
    conversationId?: string | null
    composerMode?: 'chat' | 'code' | null
  }) => Promise<ComposerState | null>
  setComposerState: Dispatch<SetStateAction<ComposerState | null>>
}

function getComposerStateSyncTarget(input: {
  activeView: WorkspaceState['activeView']
  composerProjectId: string
  inboxComposerMode: 'chat' | 'code'
  inboxProjectId: string | null
  inboxConversationId: string | null
  selectedConversationId: string | null
}) {
  if (input.activeView === 'inbox') {
    return {
      composerMode: input.inboxComposerMode,
      projectId: input.inboxProjectId,
      conversationId: input.inboxConversationId,
    }
  }

  const conversationId =
    input.activeView === 'chat' || input.activeView === 'thread' || input.activeView === 'gitops'
      ? input.selectedConversationId
      : null

  return {
    composerMode: input.activeView === 'chat' ? ('chat' as const) : ('code' as const),
    projectId: input.composerProjectId,
    conversationId,
  }
}

export function useComposerStateSync({
  workspaceState,
  selectedInboxThread,
  composerProjectId,
  shellComposerState,
  shellAppSettings,
  loadComposerState,
  setComposerState,
}: UseComposerStateSyncInput) {
  const inboxComposerMode = getInboxThreadComposerMode(selectedInboxThread)
  const inboxProjectId = selectedInboxThread?.projectId ?? null
  const inboxConversationId = selectedInboxThread?.conversationId ?? null

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
      inboxConversationId,
      selectedConversationId: workspaceState.selectedConversationId,
    })

    if (!target.projectId) {
      return
    }

    let cancelled = false

    const syncComposerState = async () => {
      const nextComposerState = await loadComposerState({
        projectId: target.projectId,
        conversationId: target.conversationId,
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
    inboxConversationId,
    setComposerState,
    shellAppSettings?.chatModel,
    shellAppSettings?.chatThinkingLevel,
    shellAppSettings?.codeModel,
    shellAppSettings?.codeThinkingLevel,
    workspaceState.activeView,
    workspaceState.selectedConversationId,
  ])
}
