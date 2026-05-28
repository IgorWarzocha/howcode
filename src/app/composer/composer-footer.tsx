import { ComposerDiffBaselineSelector, getGitOpsEntryButtonClass } from '@howcode/native-gitops'
import { Bot, FileCode2, GitBranch, Terminal } from 'lucide-react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { PiLogoMark } from '../common/pi-logo-mark'
import { ToolbarButton } from '../common/toolbar-button'
import type {
  ComposerContextUsage,
  ComposerModel,
  ComposerThinkingLevel,
  ProjectDiffBaseline,
  ProjectGitState,
} from '../desktop/types'
import type { Message } from '../types'
import { compactIconButtonClass, iconActionButtonDisabledClass } from '../ui/classes'
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
  onOpenTakeoverTerminal: () => void
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
  onOpenTakeoverTerminal,
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
  const gitVisualMode = projectGitState?.isGitRepo
    ? projectGitState.fileCount > 0
      ? 'dirty'
      : 'clean'
    : 'not-git'

  return (
    <div className={workspaceFooterRowClass}>
      {showTerminalControls ? (
        <>
          <ToolbarButton
            label="TUI"
            tooltip="Pi-TUI takeover"
            icon={<PiLogoMark className="h-[14px] w-[14px]" />}
            className={workspaceFooterTextClass}
            onClick={onOpenTakeoverTerminal}
          />
          <ToolbarButton
            label="Terminal"
            icon={<Terminal size={14} />}
            onClick={onToggleTerminal}
            className={cn(
              workspaceFooterTextClass,
              'composer-terminal-control',
              terminalVisible && 'bg-[color:var(--surface-hover)] text-[color:var(--text)]',
            )}
          />
        </>
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
        {projectGitState?.isGitRepo ? (
          <ComposerDiffBaselineSelector
            composerPanelRef={composerPanelRef}
            branch={projectGitState.branch}
            parentBranchName={parentBranchName}
            projectId={projectId}
            projectGitState={projectGitState}
            selectedBaseline={diffBaseline}
            onSelectBaseline={onSelectBaseline}
          />
        ) : null}
        {showTerminalControls ? (
          <button
            type="button"
            className={cn(
              compactIconButtonClass,
              'composer-gitops-control h-7 w-7',
              getGitOpsEntryButtonClass(gitVisualMode),
            )}
            onClick={onOpenGitOps}
            aria-label="Git ops"
            data-tooltip="Git ops"
          >
            <GitBranch size={14} />
          </button>
        ) : (
          <ToolbarButton
            label="Artifacts"
            icon={<FileCode2 size={14} />}
            trailing
            className={cn(
              workspaceFooterTextClass,
              iconActionButtonDisabledClass,
              artifactsVisible && 'bg-[color:var(--surface-hover)] text-[color:var(--text)]',
            )}
            onClick={onToggleArtifacts}
            disabled={!(artifactsAvailable && onToggleArtifacts)}
            aria-disabled={!(artifactsAvailable && onToggleArtifacts)}
          />
        )}
      </div>
    </div>
  )
}
