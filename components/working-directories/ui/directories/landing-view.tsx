import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { type KeyboardEvent, useState } from 'react'
import type { AppSettings, DesktopActionInvoker } from '../../../../src/app/desktop/types'
import type { WorkingDirectory } from '../../../../src/app/types'
import { getLandingOverviewContent } from './landing-overview-content'
import { EmptyLandingOverview } from './landing-view-parts'

type LandingViewProps = {
  appSettings: AppSettings
  directoryName: string
  directories: WorkingDirectory[]
  selectedDirectoryId: string
  className?: string
  composerOverlayHeight: number
  onAction: DesktopActionInvoker
  onSelectDirectory: (directoryId: string) => void
  onOpenChat: (directoryId: string, chatId: string, conversationId: string) => void
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
