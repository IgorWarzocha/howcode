import { Download, RotateCw } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { MarkdownContent } from '../common/markdown-content'
import { useAppUpdateFlow } from '../hooks/useAppUpdateFlow'
import {
  appTypeGroupTextClass,
  appTypeSectionTitleClass,
  compactRoundIconButtonClass,
  toolbarButtonClass,
} from '../ui/classes'
import { cn } from '../utils/cn'
import type { LandingOverviewContent } from './landing-overview-content'

export function PixelHLogo() {
  const pixelRows = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 2, 3, 0, 0, 0, 0, 0, 3, 2, 1],
    [1, 2, 3, 0, 0, 0, 0, 0, 3, 2, 1],
    [1, 2, 3, 0, 0, 0, 0, 0, 3, 2, 1],
    [2, 3, 4, 0, 0, 0, 0, 0, 4, 3, 2],
    [2, 3, 4, 2, 3, 4, 3, 2, 4, 3, 2],
    [3, 4, 5, 3, 4, 5, 4, 3, 5, 4, 3],
    [2, 3, 4, 2, 3, 4, 3, 2, 4, 3, 2],
    [2, 3, 4, 0, 0, 0, 0, 0, 4, 3, 2],
    [1, 2, 3, 0, 0, 0, 0, 0, 3, 2, 1],
    [1, 2, 3, 0, 0, 0, 0, 0, 3, 2, 1],
    [1, 2, 3, 0, 0, 0, 0, 0, 3, 2, 1],
    [2, 3, 4, 0, 0, 0, 0, 0, 4, 3, 2],
    [2, 3, 4, 0, 0, 0, 0, 0, 4, 3, 2],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ]
  const fills = {
    1: '#727894',
    2: '#969db7',
    3: '#a9b1ea',
    4: '#b9bff3',
    5: '#d5daed',
  } as const
  const cell = 52
  const pixels = pixelRows.flatMap((row, rowIndex) =>
    row.flatMap((value, columnIndex) => {
      if (value === 0) return []
      const x = columnIndex * cell + 114
      const y = rowIndex * cell + 10
      return [{ key: `${x}:${y}`, x, y, fill: fills[value as keyof typeof fills] }]
    }),
  )

  return (
    <svg
      viewBox="0 0 800 800"
      aria-label="Howcode logo"
      role="img"
      className="h-[clamp(64px,12vh,120px)] w-[clamp(49px,9.2vh,92px)]"
    >
      {pixels.map((pixel) => (
        <rect
          key={pixel.key}
          x={pixel.x}
          y={pixel.y}
          width={cell}
          height={cell}
          rx="0"
          fill={pixel.fill}
        />
      ))}
    </svg>
  )
}

export function LandingUpdateCard() {
  const { step, isRunning, advance } = useAppUpdateFlow()
  const Icon =
    step.id === 'idle' ||
    step.id === 'up-to-date' ||
    step.id === 'checking' ||
    step.id === 'error' ||
    step.id === 'ready' ||
    step.id === 'restarting' ||
    step.id === 'installing'
      ? RotateCw
      : Download

  return (
    <div className={cn(toolbarButtonClass, 'group rounded-full opacity-55 hover:opacity-100')}>
      <span>{step.label}</span>
      <button
        type="button"
        aria-label={step.action}
        title={step.action}
        className={cn(
          compactRoundIconButtonClass,
          'h-6 w-6 opacity-70 active:scale-[0.96] disabled:cursor-default group-hover:opacity-100',
        )}
        onClick={advance}
        disabled={isRunning}
      >
        <Icon size={14} className={cn(isRunning && 'animate-spin')} aria-hidden="true" />
      </button>
    </div>
  )
}

export function EmptyLandingOverview({
  content,
  activeSectionIndex,
  activePanelId,
  onSelectSection,
  onTabKeyDown,
}: {
  content: LandingOverviewContent
  activeSectionIndex: number
  activePanelId: string
  onSelectSection: (index: number) => void
  onTabKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
}) {
  const activeContent = content.sections[activeSectionIndex] ?? content.sections[0]
  return (
    <div className="grid h-full min-h-0 w-full max-w-[760px] grid-rows-[auto_auto_minmax(0,1fr)] justify-items-center gap-3 text-center sm:gap-4">
      <PixelHLogo />
      <h1 className="sr-only">{content.title}</h1>
      <LandingUpdateCard />
      <div className="grid min-h-0 w-full max-w-[680px] grid-rows-[auto_minmax(0,1fr)] gap-0">
        <div
          className="grid border-b border-[rgba(169,178,215,0.08)]"
          style={{ gridTemplateColumns: `repeat(${content.sections.length}, minmax(0, 1fr))` }}
          role="tablist"
          aria-label={content.title}
        >
          {content.sections.map((section, index) => {
            const selected = activeSectionIndex === index
            return (
              <button
                key={section.title}
                type="button"
                id={`landing-section-${index}-tab`}
                role="tab"
                className={cn(
                  `border-b px-0 py-3 text-center ${appTypeSectionTitleClass} transition-colors sm:py-4`,
                  selected
                    ? 'border-[color:var(--accent)] text-[color:var(--text)]'
                    : 'border-transparent text-[color:var(--muted)] hover:text-[color:var(--text)]',
                )}
                onClick={() => onSelectSection(index)}
                onKeyDown={onTabKeyDown}
                aria-selected={selected}
                aria-controls={activePanelId}
                tabIndex={selected ? 0 : -1}
              >
                {section.title}
              </button>
            )
          })}
        </div>
        <div
          id={activePanelId}
          className="min-h-0 overflow-y-auto pt-4 pr-2 pb-6 text-left [scrollbar-gutter:stable]"
          role="tabpanel"
          aria-labelledby={`landing-section-${activeSectionIndex}-tab`}
        >
          <MarkdownContent
            markdown={activeContent?.markdown ?? ''}
            className={`gap-2 ${appTypeGroupTextClass}`}
          />
        </div>
      </div>
    </div>
  )
}
