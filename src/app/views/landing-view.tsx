import { type KeyboardEvent, useState } from 'react'
import type { AppSettings, DesktopActionInvoker } from '../desktop/types'
import type { Project } from '../types'
import { cn } from '../utils/cn'
import { getLandingOverviewContent } from './landing-overview-content'
import { EmptyLandingOverview } from './landing-view-parts'

type LandingViewProps = {
  appSettings: AppSettings
  projectName: string
  projects: Project[]
  selectedProjectId: string
  className?: string
  composerOverlayHeight: number
  onAction: DesktopActionInvoker
  onSelectProject: (projectId: string) => void
  onOpenThread: (projectId: string, threadId: string, sessionPath: string) => void
}

export function LandingView({ className }: LandingViewProps) {
  const content = getLandingOverviewContent()
  const [activeSectionIndex, setActiveSectionIndex] = useState(0)
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
      <EmptyLandingOverview
        content={content}
        activeSectionIndex={activeSectionIndex}
        activePanelId={activePanelId}
        onSelectSection={setActiveSectionIndex}
        onTabKeyDown={handleTabKeyDown}
      />
    </section>
  )
}
