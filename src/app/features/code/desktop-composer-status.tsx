import { Bot, Brain, Gauge, Server } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { getPersistedSessionPath } from '../../../../shared/session-paths'
import { ComposerModelPopover } from '../../components/workspace/composer/composer-model-popover'
import type {
  ComposerContextUsage,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
} from '../../desktop/types'
import { useDismissibleLayer } from '../../hooks/useDismissibleLayer'
import { cn } from '../../utils/cn'

type DesktopComposerStatusProps = {
  className?: string | undefined
  contextUsage: ComposerContextUsage | null
  model: ComposerModel | null
  thinkingLevel: ComposerThinkingLevel
  interactive?: boolean
  menuOpen?: boolean
  triggerRef?: React.RefObject<HTMLButtonElement | null>
  onToggleMenu?: () => void
}

type DesktopComposerStatusModelPickerProps = {
  composerMode: 'chat' | 'code'
  availableModels: ComposerModel[]
  availableThinkingLevels: ComposerThinkingLevel[]
  className?: string | undefined
  contextUsage: ComposerContextUsage | null
  model: ComposerModel | null
  projectId: string
  sessionPath: string | null
  thinkingLevel: ComposerThinkingLevel
  onAction: DesktopActionInvoker
}

const statusLineClass =
  'flex min-w-0 flex-row-reverse items-center gap-1.5 truncate text-right text-[11px] leading-4 text-[color:var(--muted)]'

const iconClass = 'shrink-0 text-[rgba(169,178,215,0.58)]'

const thinkingLevelLabels: Record<ComposerThinkingLevel, string> = {
  off: 'Off',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'X-High',
}

function formatContextPercent(contextUsage: ComposerContextUsage | null) {
  if (contextUsage?.percent === null || contextUsage?.percent === undefined) {
    return '—'
  }

  return `${contextUsage.percent.toFixed(0)}%`
}

export function DesktopComposerStatus({
  className,
  contextUsage,
  interactive = false,
  menuOpen = false,
  model,
  onToggleMenu,
  thinkingLevel,
  triggerRef,
}: DesktopComposerStatusProps) {
  const rows = [
    { id: 'context', icon: Gauge, label: formatContextPercent(contextUsage) },
    { id: 'thinking', icon: Brain, label: thinkingLevelLabels[thinkingLevel] },
    { id: 'model', icon: Bot, label: model?.name ?? 'No model', highlight: true },
    { id: 'provider', icon: Server, label: model?.provider ?? 'No provider' },
  ]

  const content = rows.map((row) => {
    const Icon = row.icon
    return (
      <div key={row.id} className={statusLineClass}>
        <Icon size={11} className={iconClass} />
        <span
          className={cn('min-w-0 flex-1 truncate', row.highlight && 'text-[color:var(--text)]')}
        >
          {row.label}
        </span>
      </div>
    )
  })

  const statusClassName = cn(
    'pointer-events-auto ml-auto grid w-36 select-none gap-0.5 rounded-xl px-1.5 py-1 text-right opacity-70 transition-opacity hover:opacity-100',
    interactive &&
      'cursor-pointer hover:bg-[color:var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]',
    menuOpen && 'bg-[color:var(--surface-hover)] opacity-100',
    className,
  )

  if (interactive) {
    return (
      <button
        ref={triggerRef}
        type="button"
        className={statusClassName}
        onClick={onToggleMenu}
        aria-label="Model settings"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls="composer-model-menu"
      >
        {content}
      </button>
    )
  }

  return (
    <section
      className={cn(
        'pointer-events-auto ml-auto grid w-36 select-none gap-0.5 rounded-xl px-1.5 py-1 text-right opacity-70 transition-opacity hover:opacity-100',
        className,
      )}
      aria-label="Composer status"
    >
      {content}
    </section>
  )
}

export function DesktopComposerStatusModelPicker({
  availableModels,
  availableThinkingLevels,
  className,
  composerMode,
  contextUsage,
  model,
  projectId,
  sessionPath,
  thinkingLevel,
  onAction,
}: DesktopComposerStatusModelPickerProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeMenu = useCallback(() => setOpen(false), [])
  const persistedSessionPath = getPersistedSessionPath(sessionPath)

  useDismissibleLayer({ open, onDismiss: closeMenu, refs: [triggerRef, panelRef] })

  const selectModel = useCallback(
    (availableModel: ComposerModel) => {
      if (!persistedSessionPath) {
        void onAction('settings.update', {
          key: composerMode === 'chat' ? 'chatModel' : 'codeModel',
          provider: availableModel.provider,
          modelId: availableModel.id,
        })
        return
      }

      void onAction('composer.model', {
        provider: availableModel.provider,
        modelId: availableModel.id,
        projectId,
        sessionPath,
      })
    },
    [composerMode, onAction, persistedSessionPath, projectId, sessionPath],
  )

  const selectThinkingLevel = useCallback(
    (level: ComposerThinkingLevel) => {
      if (!persistedSessionPath) {
        void onAction('settings.update', {
          key: composerMode === 'chat' ? 'chatThinkingLevel' : 'codeThinkingLevel',
          value: level,
        })
        return
      }

      void onAction('composer.thinking', {
        level,
        projectId,
        sessionPath,
      })
    },
    [composerMode, onAction, persistedSessionPath, projectId, sessionPath],
  )

  return (
    <div className="relative ml-auto">
      <DesktopComposerStatus
        className={className}
        contextUsage={contextUsage}
        interactive
        menuOpen={open}
        model={model}
        thinkingLevel={thinkingLevel}
        triggerRef={triggerRef}
        onToggleMenu={() => setOpen((current) => !current)}
      />
      {open ? (
        <ComposerModelPopover
          anchorRef={triggerRef}
          availableModels={availableModels}
          availableThinkingLevels={availableThinkingLevels}
          currentModel={model}
          currentThinkingLevel={thinkingLevel}
          panelRef={panelRef}
          preferSidePlacement
          thinkingLevelLabels={thinkingLevelLabels}
          onSelectModel={selectModel}
          onSelectThinkingLevel={selectThinkingLevel}
        />
      ) : null}
    </div>
  )
}
