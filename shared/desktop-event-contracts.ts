import type { Artifact } from './desktop-artifact-contracts'
import type { ComposerState } from './desktop-composer-contracts'
import type { DictationModelId } from './desktop-dictation-contracts'
import type { ProjectDiffStreamEvent } from './desktop-project-git-contracts'
import type { ThreadData } from './desktop-thread-contracts'
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
  | { type: 'project-diff-stream'; event: ProjectDiffStreamEvent }
  | {
      type: 'runtime-diagnostic'
      severity: 'info' | 'warning' | 'error'
      message: string
      details?: unknown
      conversationId?: string | null | undefined
      projectId?: string | null | undefined
    }
  | { type: 'internal-thread-update'; conversationId: string }
  | {
      type: 'artifact-update'
      conversationId: string
      artifact: Artifact
    }
  | {
      type: 'thread-update'
      reason: 'start' | 'update' | 'end' | 'external' | 'compaction-start' | 'compaction'
      projectId: string
      threadId: string
      conversationId: string
      branchName?: string | null | undefined
      replacesConversationId?: string | null | undefined
      chatGroupId?: string | null | undefined
      isChat?: boolean | undefined
      thread: ThreadData
      composer: ComposerState | null
    }
  | {
      type: 'composer-update'
      projectId: string | null
      conversationId: string | null
      composer: ComposerState
    }
