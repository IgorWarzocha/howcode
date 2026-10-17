import type { DirectoryDiffStreamEvent } from '@howaboua/howcode-git/contracts'
import type { ChatData } from './desktop-chat-contracts'
import type { ComposerState } from './desktop-composer-contracts'
import type { KeybindingCommandId } from './keybindings'

export type DesktopEvent =
  | { type: 'workspace-layout-changed'; conversationId: string; revision: number }
  | { type: 'plugin-event'; plugin: string; event: unknown }
  | { type: 'terminal-runtime-changed'; available: boolean }
  | { type: 'package-ui-invalidation' }
  | { type: 'shell-state-refresh' }
  | { type: 'keybinding-command'; commandId: KeybindingCommandId }
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
      type: 'chat-update'
      reason: 'start' | 'update' | 'end' | 'external' | 'compaction-start' | 'compaction'
      directoryId: string
      chatId: string
      conversationId: string
      branchName?: string | null | undefined
      replacesConversationId?: string | null | undefined
      workspaceId?: string | null | undefined
      chat: ChatData
      composer: ComposerState | null
    }
  | {
      type: 'composer-update'
      directoryId: string | null
      conversationId: string | null
      composer: ComposerState
    }
