import { getPersistedSessionPath } from '@howcode/shared/session-paths'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { DesktopAction } from '../desktop/actions'
import type { DesktopActionInvoker, ProjectDiffBaseline, ProjectGitState } from '../desktop/types'
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
} as const

type RunComposerAction = (
  action: DesktopAction,
  payload: NonNullable<Parameters<DesktopActionInvoker>[1]>,
  options?: { closeMenu?: boolean } | undefined,
) => Promise<boolean>

export function ComposerPromptFooter({
  activeView,
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
  onOpenGitOps,
  onOpenTakeoverTerminal,
  onSetDiffBaseline,
  onToggleArtifacts,
  onToggleTerminal,
  parentBranchName,
  preferPortalModelPopover,
  projectGitState,
  projectId,
  runComposerAction,
  runtime,
  sessionPath,
  setOpenMenu,
  showTerminalControls,
  terminalVisible,
}: {
  activeView: View
  artifactsAvailable?: boolean | undefined
  artifactsVisible?: boolean | undefined
  compact: () => Promise<void>
  composerPanelRef: RefObject<HTMLDivElement | null>
  diffBaseline: ProjectDiffBaseline
  isStreaming: boolean
  messages?: Message[] | undefined
  modelButtonRef: RefObject<HTMLButtonElement | null>
  modelMenuOpen: boolean
  modelMenuRef: RefObject<HTMLDivElement | null>
  onOpenGitOps: () => void
  onOpenTakeoverTerminal: () => void
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void
  onToggleArtifacts?: (() => void) | undefined
  onToggleTerminal: () => void
  parentBranchName?: string | null | undefined
  preferPortalModelPopover: boolean
  projectGitState: ProjectGitState | null
  projectId: string
  runComposerAction: RunComposerAction
  runtime: ComposerRuntimeModel
  sessionPath: string | null
  setOpenMenu: Dispatch<SetStateAction<'model' | 'picker' | null>>
  showTerminalControls: boolean
  terminalVisible: boolean
}) {
  const composerMode = activeView === 'chat' ? 'chat' : 'code'
  const persistedSessionPath = getPersistedSessionPath(sessionPath)

  return (
    <ComposerFooter
      availableModels={runtime.availableModels}
      availableThinkingLevels={runtime.availableThinkingLevels}
      composerPanelRef={composerPanelRef}
      diffBaseline={diffBaseline}
      model={runtime.currentModel}
      contextUsage={runtime.contextUsage}
      messages={messages}
      compactDisabled={isStreaming || runtime.isCompacting || !sessionPath}
      isCompacting={runtime.isCompacting}
      modelButtonRef={modelButtonRef}
      modelMenuOpen={modelMenuOpen}
      modelMenuRef={modelMenuRef}
      preferPortalModelPopover={preferPortalModelPopover}
      onOpenGitOps={onOpenGitOps}
      onOpenTakeoverTerminal={onOpenTakeoverTerminal}
      onSelectBaseline={onSetDiffBaseline}
      onSelectModel={(availableModel) => {
        if (isConversationComposerView(activeView) && !persistedSessionPath) {
          return runComposerAction(
            'settings.update',
            {
              key: composerMode === 'chat' ? 'chatModel' : 'codeModel',
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
            projectId,
            sessionPath,
          },
          { closeMenu: false },
        )
      }}
      onSelectThinkingLevel={(level) => {
        if (isConversationComposerView(activeView) && !persistedSessionPath) {
          return runComposerAction('settings.update', {
            key: composerMode === 'chat' ? 'chatThinkingLevel' : 'codeThinkingLevel',
            value: level,
          })
        }

        return runComposerAction('composer.thinking', {
          level,
          projectId,
          sessionPath,
        })
      }}
      onCompact={() => void compact()}
      onSetOpenMenu={setOpenMenu}
      onToggleTerminal={onToggleTerminal}
      onToggleArtifacts={onToggleArtifacts}
      projectGitState={projectGitState}
      parentBranchName={parentBranchName}
      projectId={projectId}
      showTerminalControls={showTerminalControls}
      terminalVisible={terminalVisible}
      artifactsVisible={artifactsVisible}
      artifactsAvailable={artifactsAvailable}
      thinkingLevel={runtime.currentThinkingLevel}
      thinkingLevelLabels={thinkingLevelLabels}
    />
  )
}
