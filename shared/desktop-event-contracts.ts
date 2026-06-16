import type { AppUpdateState } from './desktop-app-update-contracts'
import type { Artifact } from './desktop-artifact-contracts'
import type { ComposerState, PiExtensionUiState } from './desktop-composer-contracts'
import type { DictationModelId } from './desktop-dictation-contracts'
import type { ProjectDiffStreamEvent } from './desktop-project-git-contracts'
import type { ThreadData } from './desktop-thread-contracts'
import type { KeybindingCommandId } from './keybindings'

export type DesktopEvent =
  | {
      type: 'app-update'
      state: AppUpdateState
    }
  | {
      type: 'shell-state-refresh'
    }
  | {
      type: 'keybinding-command'
      commandId: KeybindingCommandId
    }
  | {
      type: 'dictation-download-log'
      modelId: DictationModelId
      message: string
      at: string
      done: boolean
      isError: boolean
    }
  | {
      type: 'project-diff-stream'
      event: ProjectDiffStreamEvent
    }
  | {
      type: 'runtime-diagnostic'
      severity: 'info' | 'warning' | 'error'
      message: string
      details?: unknown
      sessionPath?: string | undefined | null | undefined
      projectId?: string | undefined | null | undefined
    }
  | {
      type: 'internal-thread-update'
      sessionPath: string
    }
  | {
      type: 'session-tree-refresh'
      sessionPath: string
    }
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
      sessionPath: string
      branchName?: string | undefined | null | undefined
      replacesSessionPath?: string | undefined | null | undefined
      chatGroupId?: string | undefined | null | undefined
      isChat?: boolean | undefined
      thread: ThreadData
      composer: ComposerState | null
    }
  | {
      type: 'composer-update'
      projectId: string | null
      sessionPath: string | null
      composer: ComposerState
    }
  | {
      type: 'pi-extension-ui-update'
      projectId: string | null
      sessionPath: string
      extensionUi: PiExtensionUiState
    }
