import { getPersistedConversationId } from '@howcode/shared/conversation-ids'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { DesktopAction } from '../desktop/actions'
import type {
  DesktopActionInvoker,
  DirectoryDiffBaseline,
  DirectoryGitState,
} from '../desktop/types'
import type { Message, View } from '../types'
import { ComposerFooter } from './composer-footer'
import { isConversationComposerView } from './composer-prompt-surface-helpers'
import type { ComposerRuntimeModel } from './composer-runtime-model'

const thinkingLevelLabels = {
  off: 'Off',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'X-High',
  max: 'Max',
} as const

type RunComposerAction = (
  action: DesktopAction,
  payload: NonNullable<Parameters<DesktopActionInvoker>[1]>,
  options?: { closeMenu?: boolean } | undefined,
) => Promise<boolean>

export function ComposerPromptFooter({
  activeView,
  composerProfile = 'coding',
  artifactsAvailable,
  artifactsVisible,
  compact,
  composerPanelRef,
  diffBaseline,
  isStreaming,
  messages,
  modelButtonRef,
  modelMenuOpen,
  modelMenuRef,
  onSetDiffBaseline,
  onToggleArtifacts,
  onToggleTerminal,
  parentBranchName,
  preferPortalModelPopover,
  directoryGitState,
  directoryId,
  runComposerAction,
  runtime,
  conversationId,
  setOpenMenu,
  showTerminalControls,
  terminalVisible,
}: {
  activeView: View
  composerProfile?: 'general' | 'coding'
  artifactsAvailable?: boolean | undefined
  artifactsVisible?: boolean | undefined
  compact: () => Promise<void>
  composerPanelRef: RefObject<HTMLDivElement | null>
  diffBaseline: DirectoryDiffBaseline
  isStreaming: boolean
  messages?: Message[] | undefined
  modelButtonRef: RefObject<HTMLButtonElement | null>
  modelMenuOpen: boolean
  modelMenuRef: RefObject<HTMLDivElement | null>
  onSetDiffBaseline: (baseline: DirectoryDiffBaseline) => void
  onToggleArtifacts?: (() => void) | undefined
  onToggleTerminal: () => void
  parentBranchName?: string | null | undefined
  preferPortalModelPopover: boolean
  directoryGitState: DirectoryGitState | null
  directoryId: string
  runComposerAction: RunComposerAction
  runtime: ComposerRuntimeModel
  conversationId: string | null
  setOpenMenu: Dispatch<SetStateAction<'model' | 'picker' | null>>
  showTerminalControls: boolean
  terminalVisible: boolean
}) {
  const persistedConversationId = getPersistedConversationId(conversationId)

  return (
    <ComposerFooter
      availableModels={runtime.availableModels}
      availableThinkingLevels={runtime.availableThinkingLevels}
      composerPanelRef={composerPanelRef}
      diffBaseline={diffBaseline}
      model={runtime.currentModel}
      contextUsage={runtime.contextUsage}
      messages={messages}
      compactDisabled={isStreaming || runtime.isCompacting || !conversationId}
      isCompacting={runtime.isCompacting}
      modelButtonRef={modelButtonRef}
      modelMenuOpen={modelMenuOpen}
      modelMenuRef={modelMenuRef}
      preferPortalModelPopover={preferPortalModelPopover}
      onSelectBaseline={onSetDiffBaseline}
      onSelectModel={(availableModel) => {
        if (isConversationComposerView(activeView) && !persistedConversationId) {
          return runComposerAction(
            'settings.update',
            {
              key: composerProfile === 'general' ? 'chatModel' : 'codeModel',
              provider: availableModel.provider,
              modelId: availableModel.id,
            },
            { closeMenu: false },
          )
        }

        return runComposerAction(
          'composer.model',
          {
            provider: availableModel.provider,
            modelId: availableModel.id,
            directoryId,
            conversationId,
          },
          { closeMenu: false },
        )
      }}
      onSelectThinkingLevel={(level) => {
        if (isConversationComposerView(activeView) && !persistedConversationId) {
          return runComposerAction('settings.update', {
            key: composerProfile === 'general' ? 'chatThinkingLevel' : 'codeThinkingLevel',
            value: level,
          })
        }

        return runComposerAction('composer.thinking', {
          level,
          directoryId,
          conversationId,
        })
      }}
      onCompact={() => void compact()}
      onSetOpenMenu={setOpenMenu}
      onToggleTerminal={onToggleTerminal}
      onToggleArtifacts={onToggleArtifacts}
      directoryGitState={directoryGitState}
      parentBranchName={parentBranchName}
      directoryId={directoryId}
      showTerminalControls={showTerminalControls}
      terminalVisible={terminalVisible}
      artifactsVisible={artifactsVisible}
      artifactsAvailable={artifactsAvailable}
      thinkingLevel={runtime.currentThinkingLevel}
      thinkingLevelLabels={thinkingLevelLabels}
    />
  )
}
