import type { Dispatch, SetStateAction } from 'react'
import { useEffect } from 'react'
import { getInboxChatComposerProfile } from '../common/inbox-chat-scope'
import type { AppSettings, ComposerState, InboxChat } from '../desktop/types'
import type { WorkspaceState } from '../state/workspace-model'

type UseComposerStateSyncInput = {
  workspaceState: WorkspaceState
  selectedInboxChat: InboxChat | null
  composerDirectoryId: string
  shellComposerState: ComposerState | null | undefined
  shellAppSettings: AppSettings | null | undefined
  loadComposerState: (request?: {
    directoryId?: string | null
    conversationId?: string | null
    composerProfile?: 'general' | 'coding' | null
  }) => Promise<ComposerState | null>
  setComposerState: Dispatch<SetStateAction<ComposerState | null>>
}

function getComposerStateSyncTarget(input: {
  composerProfile: WorkspaceState['composerProfile']
  activeView: WorkspaceState['activeView']
  composerDirectoryId: string
  inboxComposerProfile: 'general' | 'coding'
  inboxDirectoryId: string | null
  inboxConversationId: string | null
  selectedConversationId: string | null
}) {
  if (input.activeView === 'inbox') {
    return {
      composerProfile: input.inboxComposerProfile,
      directoryId: input.inboxDirectoryId,
      conversationId: input.inboxConversationId,
    }
  }

  const conversationId = input.activeView === 'chat' ? input.selectedConversationId : null

  return {
    composerProfile: input.composerProfile,
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
  const inboxComposerProfile = getInboxChatComposerProfile(selectedInboxChat)
  const inboxDirectoryId = selectedInboxChat?.directoryId ?? null
  const inboxConversationId = selectedInboxChat?.conversationId ?? null

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
      activeView: workspaceState.activeView.startsWith('component:')
        ? (workspaceState.utilityViewReturnState?.activeView ?? 'chat')
        : workspaceState.activeView,
      composerProfile: workspaceState.composerProfile,
      composerDirectoryId,
      inboxComposerProfile,
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
        composerProfile: target.composerProfile,
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
    inboxComposerProfile,
    inboxDirectoryId,
    inboxConversationId,
    setComposerState,
    shellAppSettings?.chatModel,
    shellAppSettings?.chatThinkingLevel,
    shellAppSettings?.codeModel,
    shellAppSettings?.codeThinkingLevel,
    workspaceState.activeView,
    workspaceState.utilityViewReturnState,
    workspaceState.composerProfile,
    workspaceState.selectedConversationId,
  ])
}
