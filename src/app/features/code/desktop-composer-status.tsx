import { Bot, Brain, Gauge, Server } from 'lucide-react'
import type {
  ComposerContextUsage,
  ComposerModel,
  ComposerThinkingLevel,
} from '../../desktop/types'
import { cn } from '../../utils/cn'

type DesktopComposerStatusProps = {
  className?: string
  contextUsage: ComposerContextUsage | null
  model: ComposerModel | null
  thinkingLevel: ComposerThinkingLevel
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
  model,
  thinkingLevel,
}: DesktopComposerStatusProps) {
  const rows = [
    { id: 'context', icon: Gauge, label: formatContextPercent(contextUsage) },
    { id: 'thinking', icon: Brain, label: thinkingLevelLabels[thinkingLevel] },
    { id: 'model', icon: Bot, label: model?.name ?? 'No model', highlight: true },
    { id: 'provider', icon: Server, label: model?.provider ?? 'No provider' },
  ]

  return (
    <section
      className={cn(
        'pointer-events-auto ml-auto grid w-36 select-none gap-0.5 rounded-xl px-1.5 py-1 text-right opacity-70 transition-opacity hover:opacity-100',
        className,
      )}
      aria-label="Composer status"
    >
      {rows.map((row) => {
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
      })}
    </section>
  )
}
