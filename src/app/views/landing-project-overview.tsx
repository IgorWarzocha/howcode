import { CircleDot, ExternalLink, GitBranch } from 'lucide-react'
import { parseGitHubRepositoryUrl } from '../../../shared/github-repository-url'
import { GitHubInvertocatMark } from '../components/common/github-invertocat-mark'
import type { DesktopActionInvoker, ProjectGitState, ProjectUsageSummary } from '../desktop/types'
import { openExternalQuery } from '../query/desktop-query'
import type { Project } from '../types'
import { ghostButtonClass } from '../ui/classes'
import { cn } from '../utils/cn'
import { DashboardBranchSwitcher } from './project-overview/dashboard-branch-switcher'
import {
  formatAverageCost,
  formatCost,
  formatExactNumber,
  formatTokens,
} from './project-overview/overview-formatters'
import { ProjectMetric } from './project-overview/project-metric'
import { TopSessionsSection } from './project-overview/top-sessions-section'

function formatGitSummary(gitState: ProjectGitState | null | undefined) {
  if (!gitState) return 'Checking repository…'
  if (!gitState.isGitRepo) return 'Not a Git repository'
  return null
}

function getGitHubRepositoryLink(project: Project, gitState: ProjectGitState | null | undefined) {
  const url = gitState === undefined ? (project.repoOriginUrl ?? null) : gitState?.originUrl
  return url ? parseGitHubRepositoryUrl(url) : null
}

function ProjectRepositorySection({
  branchLabel,
  gitState,
  gitSummary,
  githubLink,
  project,
  onAction,
}: {
  branchLabel: string
  gitState: ProjectGitState | null | undefined
  gitSummary: string | null
  githubLink: ReturnType<typeof getGitHubRepositoryLink>
  project: Project
  onAction: DesktopActionInvoker
}) {
  return (
    <section className="relative z-20 col-start-2 grid w-full gap-2">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 rounded-xl border border-[rgba(169,178,215,0.08)] bg-[rgba(255,255,255,0.02)] px-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {githubLink ? (
            <GitHubInvertocatMark size={14} className="text-[color:var(--muted)]" />
          ) : (
            <GitBranch size={14} className="text-[color:var(--muted)]" aria-hidden="true" />
          )}
          <span className="min-w-0 truncate text-[13px] font-medium text-[color:var(--text)]">
            {githubLink ? `${githubLink.owner}/${githubLink.repo}` : (gitSummary ?? branchLabel)}
          </span>
          {githubLink ? (
            <button
              type="button"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[color:var(--muted)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] active:scale-[0.96] max-[520px]:hidden"
              onClick={() => void openExternalQuery(githubLink.canonicalUrl)}
              aria-label={`Open ${githubLink.owner}/${githubLink.repo} on GitHub`}
            >
              <ExternalLink size={12} aria-hidden="true" />
            </button>
          ) : null}
          {gitState?.isGitRepo ? (
            <DashboardBranchSwitcher
              branchLabel={branchLabel}
              gitState={gitState}
              project={project}
              onAction={onAction}
            />
          ) : null}
        </div>
        {githubLink ? (
          <div className="flex min-w-0 shrink-0 items-center gap-1 max-[600px]:hidden">
            <button
              type="button"
              className={cn(
                ghostButtonClass,
                'inline-flex h-7 items-center gap-1.5 px-2 active:scale-[0.96]',
              )}
              onClick={() => void openExternalQuery(`${githubLink.canonicalUrl}/issues`)}
            >
              <CircleDot size={12} aria-hidden="true" /> Issues
            </button>
            <button
              type="button"
              className={cn(
                ghostButtonClass,
                'inline-flex h-7 items-center gap-1.5 px-2 active:scale-[0.96]',
              )}
              onClick={() => void openExternalQuery(`${githubLink.canonicalUrl}/pulls`)}
            >
              <CircleDot size={12} aria-hidden="true" /> PRs
            </button>
          </div>
        ) : null}
      </div>
      {gitSummary ? (
        <div className="px-1 text-[12px] text-[color:var(--muted)]">{gitSummary}</div>
      ) : null}
    </section>
  )
}

export function ProjectOverview({
  composerOverlayHeight,
  project,
  gitState,
  usageLoading,
  usageSummary,
  onOpenThread,
  onAction,
}: {
  composerOverlayHeight: number
  project: Project
  gitState: ProjectGitState | null | undefined
  usageLoading: boolean
  usageSummary: ProjectUsageSummary | null | undefined
  onOpenThread: (projectId: string, threadId: string, sessionPath: string) => void
  onAction: DesktopActionInvoker
}) {
  const githubLink = getGitHubRepositoryLink(project, gitState)
  const sessionCount = usageSummary?.sessionCount ?? project.threadCount ?? project.threads.length
  const sessionsWithUsageCount = usageSummary?.sessionsWithUsageCount ?? 0
  const branchLabel = gitState?.isGitRepo ? (gitState.branch ?? 'Detached HEAD') : 'No branch'
  const gitSummary = formatGitSummary(gitState)
  const assistantTurnCount = usageSummary?.assistantTurnCount ?? 0
  const measuredComposerHeight = Math.max(composerOverlayHeight, 132)
  const overviewHeight = `calc(60% - ${measuredComposerHeight / 2}px - 0.5rem)`
  return (
    <div
      className="mx-auto grid min-h-0 w-full grid-cols-[minmax(2rem,1fr)_minmax(0,800px)_minmax(2rem,1fr)] content-end gap-x-2 overflow-y-auto px-0 text-left [scrollbar-gutter:stable]"
      style={{ height: overviewHeight }}
    >
      <div className="col-start-2 grid min-h-0 w-full grid-cols-[2rem_minmax(0,1fr)_2rem] content-end gap-x-2 gap-y-3 min-[560px]:gap-y-4 [@media(max-height:660px)]:gap-y-2">
        <div className="col-start-2 grid w-full gap-1.5 [@media(max-height:660px)]:hidden">
          <div className="text-[12px] font-medium tracking-[0.12em] text-[color:var(--muted)] uppercase">
            Project overview
          </div>
          <h1 className="m-0 text-[24px] leading-tight font-medium text-[color:var(--text)] text-balance">
            {project.name}
          </h1>
        </div>

        <div className="col-start-2 grid w-full grid-cols-[repeat(auto-fit,minmax(118px,1fr))] gap-3 border-y border-[rgba(169,178,215,0.08)] py-3 min-[560px]:gap-4 [@media(max-height:660px)]:py-2">
          <ProjectMetric
            label="Sessions"
            loading={usageLoading}
            value={formatExactNumber(sessionCount)}
            detail={`${formatExactNumber(assistantTurnCount)} turns`}
          />
          <ProjectMetric
            label="Spend"
            loading={usageLoading}
            value={formatCost(usageSummary?.costTotal)}
            detail={`${formatAverageCost(usageSummary?.costTotal, sessionsWithUsageCount)}/active session`}
          />
          <ProjectMetric
            label="Tokens"
            loading={usageLoading}
            value={formatTokens(usageSummary?.totalTokens)}
            detail={`${formatTokens(usageSummary?.input)} in · ${formatTokens(usageSummary?.output)} out · ${formatTokens(usageSummary?.cacheRead)} read · ${formatTokens(usageSummary?.cacheWrite)} write`}
          />
        </div>

        <ProjectRepositorySection
          branchLabel={branchLabel}
          gitState={gitState}
          gitSummary={gitSummary}
          githubLink={githubLink}
          project={project}
          onAction={onAction}
        />

        <TopSessionsSection
          loading={usageLoading}
          projectId={project.id}
          sessions={usageSummary?.topSessions ?? []}
          onOpenThread={onOpenThread}
        />
      </div>
    </div>
  )
}
