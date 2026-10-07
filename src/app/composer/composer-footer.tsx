import { Bot } from 'lucide-react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { ToolbarButton } from '../common/toolbar-button'
import type {
  ComposerContextUsage,
  ComposerModel,
  ComposerThinkingLevel,
  ProjectDiffBaseline,
  ProjectGitState,
} from '../desktop/types'
import { ArtifactsComposerControl } from '../extensions/artifacts-plugin'
import { CodingComposerControls } from '../extensions/coding-composer-controls'
import { TerminalComposerControl } from '../extensions/terminal-plugin'
import type { Message } from '../types'
import { cn } from '../utils/cn'
import {
  workspaceFooterRowClass,
  workspaceFooterTextClass,
  workspaceFooterTrailingGroupClass,
} from '../workspace-shell/footer/workspace-footer-primitives'
import { ComposerContextMeter } from './composer-context-meter'
import { ComposerModelPopover } from './composer-model-popover'
import {
  notifyComposerPopoverOpened,
  useComposerPopoverDismissSignal,
} from './composer-popover-coordination'

type ComposerFooterProps = {
  availableModels: ComposerModel[]
  availableThinkingLevels: ComposerThinkingLevel[]
  composerPanelRef: RefObject<HTMLDivElement | null>
  diffBaseline: ProjectDiffBaseline
  model: ComposerModel | null
  contextUsage: ComposerContextUsage | null
  messages?: Message[] | undefined
  compactDisabled: boolean
  isCompacting: boolean
  modelButtonRef: RefObject<HTMLButtonElement | null>
  modelMenuOpen: boolean
  modelMenuRef: RefObject<HTMLDivElement | null>
  preferPortalModelPopover?: boolean | undefined
  onOpenGitOps: () => void
  onCompact: () => void
  onSelectBaseline: (baseline: ProjectDiffBaseline) => void
  onSelectModel: (model: ComposerModel) => void
  onSelectThinkingLevel: (level: ComposerThinkingLevel) => void
  onSetOpenMenu: Dispatch<SetStateAction<'model' | 'picker' | null>>
  onToggleArtifacts?: (() => void) | undefined
  onToggleTerminal: () => void
  projectGitState: ProjectGitState | null
  parentBranchName?: string | null | undefined
  projectId: string
  showTerminalControls?: boolean | undefined
  artifactsVisible?: boolean | undefined
  artifactsAvailable?: boolean | undefined
  terminalVisible: boolean
  thinkingLevel: ComposerThinkingLevel
  thinkingLevelLabels: Record<ComposerThinkingLevel, string>
}

export function ComposerFooter({
  availableModels,
  availableThinkingLevels,
  composerPanelRef,
  diffBaseline,
  model,
  contextUsage,
  messages,
  compactDisabled,
  isCompacting,
  modelButtonRef,
  modelMenuOpen,
  modelMenuRef,
  preferPortalModelPopover = false,
  onOpenGitOps,
  onCompact,
  onSelectBaseline,
  onSelectModel,
  onSelectThinkingLevel,
  onSetOpenMenu,
  onToggleArtifacts,
  onToggleTerminal,
  projectGitState,
  parentBranchName,
  projectId,
  showTerminalControls = true,
  artifactsVisible = false,
  artifactsAvailable = Boolean(onToggleArtifacts),
  terminalVisible,
  thinkingLevel,
  thinkingLevelLabels,
}: ComposerFooterProps) {
  const contextDismissSignal = useComposerPopoverDismissSignal({
    ignoreSource: 'model',
    onDismiss: () => onSetOpenMenu((current) => (current === 'model' ? null : current)),
  })

  return (
    <div className={workspaceFooterRowClass}>
      {showTerminalControls ? (
        <TerminalComposerControl visible={terminalVisible} onToggle={onToggleTerminal} />
      ) : null}
      <div className="relative inline-flex h-7 items-center">
        <ToolbarButton
          ref={modelButtonRef}
          label="Agent"
          tooltip="Model settings"
          icon={<Bot size={14} />}
          className={cn(workspaceFooterTextClass, 'pr-8')}
          onClick={() => {
            onSetOpenMenu((current) => {
              if (current === 'model') return null
              notifyComposerPopoverOpened('model')
              return 'model'
            })
          }}
          aria-haspopup="menu"
          aria-expanded={modelMenuOpen}
          aria-controls="composer-model-menu"
        />
        <div className="absolute top-0 right-0">
          <ComposerContextMeter
            contextUsage={contextUsage}
            dismissSignal={contextDismissSignal}
            messages={messages}
            compactDisabled={compactDisabled}
            isCompacting={isCompacting}
            onCompact={onCompact}
            onPreviewOpen={() => onSetOpenMenu((current) => (current === 'model' ? null : current))}
          />
        </div>
        {modelMenuOpen ? (
          <ComposerModelPopover
            anchorRef={modelButtonRef}
            availableModels={availableModels}
            availableThinkingLevels={availableThinkingLevels}
            currentModel={model}
            currentThinkingLevel={thinkingLevel}
            panelRef={modelMenuRef}
            preferPortalPlacement={preferPortalModelPopover}
            thinkingLevelLabels={thinkingLevelLabels}
            onSelectModel={onSelectModel}
            onSelectThinkingLevel={onSelectThinkingLevel}
          />
        ) : null}
      </div>
      <div className={workspaceFooterTrailingGroupClass}>
        <CodingComposerControls
          selector={{
            composerPanelRef,
            parentBranchName,
            projectId,
            projectGitState,
            selectedBaseline: diffBaseline,
            onSelectBaseline,
          }}
          showGitOps={showTerminalControls}
          onOpenGitOps={onOpenGitOps}
        />
        {showTerminalControls ? null : (
          <ArtifactsComposerControl
            available={artifactsAvailable}
            visible={artifactsVisible ?? false}
            onToggle={onToggleArtifacts}
          />
        )}
      </div>
    </div>
  )
}
