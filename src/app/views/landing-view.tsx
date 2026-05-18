import { useQuery } from '@tanstack/react-query'
import { type KeyboardEvent, useState } from 'react'
import type { AppSettings, DesktopActionInvoker } from '../desktop/types'
import {
  desktopQueryKeys,
  getProjectGitStateQuery,
  getProjectUsageSummaryQuery,
} from '../query/desktop-query'
import type { Project } from '../types'
import { cn } from '../utils/cn'
import { getLandingOverviewContent } from './landing-overview-content'
import { EmptyLandingOverview, ProjectOverview } from './landing-view-parts'

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

export function LandingView({
  className,
  projects,
  selectedProjectId,
  composerOverlayHeight,
  onOpenThread,
}: LandingViewProps) {
  const content = getLandingOverviewContent()
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null
  const projectUsageQuery = useQuery({
    queryKey: selectedProject
      ? desktopQueryKeys.projectUsageSummary(selectedProject.id)
      : ['desktop', 'projectUsageSummary', null],
    queryFn: () => getProjectUsageSummaryQuery(selectedProject?.id ?? ''),
    enabled: Boolean(selectedProject),
    refetchInterval: (query) => (query.state.data?.archivedUsageRefreshing ? 5000 : false),
  })
  const projectGitQuery = useQuery({
    queryKey: selectedProject
      ? desktopQueryKeys.projectGitState(selectedProject.id)
      : ['desktop', 'projectGitState', null],
    queryFn: () => getProjectGitStateQuery(selectedProject?.id ?? ''),
    enabled: Boolean(selectedProject),
  })

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
        'relative mx-auto flex h-full min-h-0 w-full justify-center overflow-hidden pb-0',
        selectedProject ? 'px-0 pt-0' : 'px-6 pt-[clamp(4rem,20vh,14rem)]',
        className,
      )}
    >
      {selectedProject ? (
        <ProjectOverview
          composerOverlayHeight={composerOverlayHeight}
          project={selectedProject}
          gitState={projectGitQuery.data}
          usageLoading={projectUsageQuery.isLoading}
          usageSummary={projectUsageQuery.data}
          onOpenThread={onOpenThread}
        />
      ) : (
        <EmptyLandingOverview
          content={content}
          activeSectionIndex={activeSectionIndex}
          activePanelId={activePanelId}
          onSelectSection={setActiveSectionIndex}
          onTabKeyDown={handleTabKeyDown}
        />
      )}
    </section>
  )
}
