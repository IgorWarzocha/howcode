import type { Artifact } from './desktop-artifact-contracts'
import type { ChatData } from './desktop-chat-contracts'
import type { ComposerState } from './desktop-composer-contracts'
import type { DictationModelId } from './desktop-dictation-contracts'
import type { DirectoryDiffStreamEvent } from './desktop-directory-git-contracts'
import type { KeybindingCommandId } from './keybindings'

export type DesktopEvent =
  | { type: 'package-ui-invalidation' }
  | { type: 'shell-state-refresh' }
  | { type: 'keybinding-command'; commandId: KeybindingCommandId }
  | {
      type: 'dictation-download-log'
      modelId: DictationModelId
      message: string
      at: string
      done: boolean
      isError: boolean
    }
  | { type: 'directory-diff-stream'; event: DirectoryDiffStreamEvent }
  | {
      type: 'runtime-diagnostic'
      severity: 'info' | 'warning' | 'error'
      message: string
      details?: unknown
      conversationId?: string | null | undefined
      directoryId?: string | null | undefined
    }
  | { type: 'internal-chat-update'; conversationId: string }
  | {
      type: 'artifact-update'
      conversationId: string
      artifact: Artifact
    }
  | {
      type: 'chat-update'
      reason: 'start' | 'update' | 'end' | 'external' | 'compaction-start' | 'compaction'
      directoryId: string
      chatId: string
      conversationId: string
      branchName?: string | null | undefined
      replacesConversationId?: string | null | undefined
      workspaceId?: string | null | undefined
      composerProfile?: 'general' | 'coding' | undefined
      chat: ChatData
      composer: ComposerState | null
    }
  | {
      type: 'composer-update'
      directoryId: string | null
      conversationId: string | null
      composer: ComposerState
    }
