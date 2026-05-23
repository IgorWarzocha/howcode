import { ArrowUpRight, Bot, X } from 'lucide-react'
import type { RefObject } from 'react'
import { IconButton } from '../../common/icon-button'
import { ToolbarButton } from '../../common/toolbar-button'
import { Tooltip } from '../../common/tooltip'
import { ComposerContextMeter } from '../../composer/composer-context-meter'
import { ComposerModelPopover } from '../../composer/composer-model-popover'
import type {
  ComposerContextUsage,
  ComposerModel,
  ComposerThinkingLevel,
} from '../../desktop/types'
import { cn } from '../../utils/cn'
import {
  workspaceFooterRowClass,
  workspaceFooterTextClass,
  workspaceFooterTrailingGroupClass,
} from '../../workspace-shell/footer/workspace-footer-primitives'

const thinkingLevelLabels: Record<ComposerThinkingLevel, string> = {
  off: 'Off',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'X-High',
}

type InboxComposerFooterProps = {
  availableModels: ComposerModel[]
  availableThinkingLevels: ComposerThinkingLevel[]
  contextUsage: ComposerContextUsage | null
  currentModel: ComposerModel | null
  currentThinkingLevel: ComposerThinkingLevel
  isCompacting: boolean
  isStreaming: boolean
  localActionPending: boolean
  modelButtonRef: RefObject<HTMLButtonElement | null>
  modelMenuOpen: boolean
  modelMenuRef: RefObject<HTMLDivElement | null>
  sessionPath: string | null
  onCompact: () => void
  onDismiss: () => void
  onOpenThread: () => void
  onSelectModel: (model: ComposerModel) => void
  onSelectThinkingLevel: (level: ComposerThinkingLevel) => void
  onToggleModelMenu: () => void
}

export function InboxComposerFooter({
  availableModels,
  availableThinkingLevels,
  contextUsage,
  currentModel,
  currentThinkingLevel,
  isCompacting,
  isStreaming,
  localActionPending,
  modelButtonRef,
  modelMenuOpen,
  modelMenuRef,
  sessionPath,
  onCompact,
  onDismiss,
  onOpenThread,
  onSelectModel,
  onSelectThinkingLevel,
  onToggleModelMenu,
}: InboxComposerFooterProps) {
  return (
    <div className={workspaceFooterRowClass}>
      <div className="relative inline-flex h-7 items-center">
        <ToolbarButton
          ref={modelButtonRef}
          label="Agent"
          tooltip="Model settings"
          icon={<Bot size={14} />}
          className={cn(workspaceFooterTextClass, 'pr-8')}
          onClick={onToggleModelMenu}
          aria-haspopup="menu"
          aria-expanded={modelMenuOpen}
          aria-controls="composer-model-menu"
        />
        <div className="absolute top-0 right-0">
          <ComposerContextMeter
            contextUsage={contextUsage}
            compactDisabled={isStreaming || isCompacting || localActionPending || !sessionPath}
            isCompacting={isCompacting}
            onCompact={onCompact}
          />
        </div>
        {modelMenuOpen ? (
          <ComposerModelPopover
            anchorRef={modelButtonRef}
            availableModels={availableModels}
            availableThinkingLevels={availableThinkingLevels}
            currentModel={currentModel}
            currentThinkingLevel={currentThinkingLevel}
            panelRef={modelMenuRef}
            thinkingLevelLabels={thinkingLevelLabels}
            onSelectModel={onSelectModel}
            onSelectThinkingLevel={onSelectThinkingLevel}
          />
        ) : null}
      </div>
      <div className={workspaceFooterTrailingGroupClass}>
        <Tooltip content="Dismiss">
          <IconButton tooltip={null} label="Dismiss" icon={<X size={14} />} onClick={onDismiss} />
        </Tooltip>
        <Tooltip content="Open thread">
          <IconButton
            tooltip={null}
            label="Open thread"
            icon={<ArrowUpRight size={14} />}
            onClick={onOpenThread}
          />
        </Tooltip>
      </div>
    </div>
  )
}
