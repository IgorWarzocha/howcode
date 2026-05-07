import { Download, RotateCw } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'
import { MarkdownContent } from '../components/common/markdown-content'
import type { AppSettings, DesktopActionInvoker } from '../desktop/types'
import { useAppUpdateFlow } from '../hooks/useAppUpdateFlow'
import type { Project } from '../types'
import { compactRoundIconButtonClass, toolbarButtonClass } from '../ui/classes'
import { cn } from '../utils/cn'
import { getLandingOverviewContent } from './landing-overview-content'

type LandingViewProps = {
  appSettings: AppSettings
  projectName: string
  projects: Project[]
  selectedProjectId: string
  className?: string
  onAction: DesktopActionInvoker
  onSelectProject: (projectId: string) => void
}

function PixelHLogo() {
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
      if (value === 0) {
        return []
      }

      const x = columnIndex * cell + 114
      const y = rowIndex * cell + 10

      return [
        {
          key: `${x}:${y}`,
          x,
          y,
          fill: fills[value as keyof typeof fills],
        },
      ]
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

function LandingMockUpdateCard() {
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

  const busy = isRunning

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
        disabled={busy}
      >
        <Icon size={14} className={cn(busy && 'animate-spin')} aria-hidden="true" />
      </button>
    </div>
  )
}

export function LandingView({ className }: LandingViewProps) {
  const content = getLandingOverviewContent()
  const [activeSectionIndex, setActiveSectionIndex] = useState(0)
  const activeContent = content.sections[activeSectionIndex] ?? content.sections[0]
  const activePanelId = 'landing-overview-panel'

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return
    }

    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const nextSectionIndex =
      (activeSectionIndex + direction + content.sections.length) % content.sections.length
    setActiveSectionIndex(nextSectionIndex)
    window.requestAnimationFrame(() => {
      document.getElementById(`landing-section-${nextSectionIndex}-tab`)?.focus()
    })
  }

  return (
    <section
      className={cn(
        'relative mx-auto flex h-full min-h-0 w-full justify-center overflow-hidden px-6 pt-[clamp(4rem,20vh,14rem)] pb-0',
        className,
      )}
    >
      <div className="grid h-full min-h-0 w-full max-w-[760px] grid-rows-[auto_auto_minmax(0,1fr)] justify-items-center gap-3 text-center sm:gap-4">
        <PixelHLogo />
        <h1 className="sr-only">{content.title}</h1>

        <LandingMockUpdateCard />

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
                    'border-b px-0 py-3 text-center text-[15px] font-medium transition-colors sm:py-4',
                    selected
                      ? 'border-[color:var(--accent)] text-[color:var(--text)]'
                      : 'border-transparent text-[color:var(--muted)] hover:text-[color:var(--text)]',
                  )}
                  onClick={() => setActiveSectionIndex(index)}
                  onKeyDown={handleTabKeyDown}
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
              className="gap-2 text-[13px]"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
