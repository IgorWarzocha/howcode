import { getPersistedConversationId } from '@howcode/shared/conversation-ids'
import type { ComposerStateRequest } from '@howcode/shared/desktop-composer-contracts'
import type { Dispatch, SetStateAction } from 'react'
import { useEffect } from 'react'
import type { AppSettings, ComposerState, InboxChat } from '../desktop/types'
import type { WorkspaceState } from '../state/workspace-model'

type UseComposerStateSyncInput = {
  workspaceState: WorkspaceState
  selectedInboxChat: InboxChat | null
  composerDirectoryId: string
  shellComposerState: ComposerState | null | undefined
  shellAppSettings: AppSettings | null | undefined
  loadComposerState: (request?: ComposerStateRequest) => Promise<ComposerState | null>
  setComposerState: Dispatch<SetStateAction<ComposerState | null>>
}

function getComposerStateSyncTarget(input: {
  activeView: WorkspaceState['activeView']
  composerDirectoryId: string
  inboxDirectoryId: string | null
  inboxConversationId: string | null
  selectedConversationId: string | null
}) {
  if (input.activeView === 'inbox') {
    return {
      directoryId: input.inboxDirectoryId,
      conversationId: input.inboxConversationId,
    }
  }

  const conversationId = input.activeView === 'chat' ? input.selectedConversationId : null

  return {
    directoryId: input.composerDirectoryId,
    conversationId,
  }
}

export function useComposerStateSync({
  workspaceState,
  selectedInboxChat,
  composerDirectoryId,
  shellComposerState,
  shellAppSettings,
  loadComposerState,
  setComposerState,
}: UseComposerStateSyncInput) {
  const inboxDirectoryId = selectedInboxChat?.directoryId ?? null
  const inboxConversationId = selectedInboxChat?.conversationId ?? null

  useEffect(() => {
    if (!shellComposerState) {
      return
    }

    setComposerState((current) => current ?? shellComposerState)
  }, [setComposerState, shellComposerState])

  useEffect(() => {
    void shellAppSettings?.defaultModel
    void shellAppSettings?.defaultThinkingLevel

    const target = getComposerStateSyncTarget({
      activeView: workspaceState.activeView.startsWith('component:')
        ? (workspaceState.utilityViewReturnState?.activeView ?? 'chat')
        : workspaceState.activeView,
      composerDirectoryId,
      inboxDirectoryId,
      inboxConversationId,
      selectedConversationId: workspaceState.selectedConversationId,
    })

    if (!target.directoryId) {
      return
    }

    let cancelled = false

    const syncComposerState = async () => {
      const nextComposerState = await loadComposerState({
        directoryId: target.directoryId,
        conversationId: target.conversationId,
        ...(getPersistedConversationId(target.conversationId) ||
        workspaceState.composerExtensions === null
          ? {}
          : { composerExtensions: workspaceState.composerExtensions }),
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
    composerDirectoryId,
    inboxDirectoryId,
    inboxConversationId,
    setComposerState,
    shellAppSettings?.defaultModel,
    shellAppSettings?.defaultThinkingLevel,
    workspaceState.activeView,
    workspaceState.utilityViewReturnState,
    workspaceState.selectedConversationId,
    workspaceState.composerExtensions,
  ])
}
