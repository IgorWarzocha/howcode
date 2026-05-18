import { CircleDot, ExternalLink, GitBranch, Github } from 'lucide-react'
import { parseGitHubRepositoryUrl } from '../../../shared/github-repository-url'
import { SkeletonBlock } from '../components/common/skeleton'
import type {
  ProjectGitState,
  ProjectUsageSessionSummary,
  ProjectUsageSummary,
} from '../desktop/types'
import { openExternalQuery } from '../query/desktop-query'
import type { Project } from '../types'
import { ghostButtonClass } from '../ui/classes'
import { cn } from '../utils/cn'

const tokenFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const numberFormatter = new Intl.NumberFormat('en')
const costFormatter = new Intl.NumberFormat('en', {
  currency: 'USD',
  maximumFractionDigits: 4,
  style: 'currency',
})

function formatTokens(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return tokenFormatter.format(value)
}

function formatExactNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return numberFormatter.format(value)
}

function formatCost(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return costFormatter.format(value)
}

function formatAverageCost(total: number | null | undefined, count: number) {
  if (total === null || total === undefined || count <= 0) return '—'
  return formatCost(total / count)
}

function formatGitSummary(gitState: ProjectGitState | null | undefined) {
  if (!gitState) return 'Checking repository…'
  if (!gitState.isGitRepo) return 'Not a Git repository'
  return null
}

function getGitHubRepositoryLink(project: Project, gitState: ProjectGitState | null | undefined) {
  const url = gitState === undefined ? (project.repoOriginUrl ?? null) : gitState?.originUrl
  return url ? parseGitHubRepositoryUrl(url) : null
}

function TopSessionsSkeleton() {
  return (
    <div className="grid max-h-[9.75rem] w-full gap-1.5 overflow-hidden pr-8 [@media(max-height:760px)]:max-h-[3.25rem]">
      {['top-session-a', 'top-session-b', 'top-session-c'].map((rowId) => (
        <div
          key={rowId}
          className="grid min-h-11 w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-lg border border-[rgba(169,178,215,0.08)] bg-[rgba(255,255,255,0.02)] px-3 py-2"
        >
          <SkeletonBlock className="h-3.5 w-[min(18rem,72%)] rounded-md" />
          <SkeletonBlock className="h-3 w-24 rounded-md opacity-60" />
        </div>
      ))}
    </div>
  )
}

function ProjectMetric({
  detail,
  label,
  loading,
  value,
}: {
  detail: string
  label: string
  loading: boolean
  value: string
}) {
  return (
    <div className="grid min-w-0 gap-1">
      <div className="text-[11px] font-medium tracking-[0.08em] text-[color:var(--muted)] uppercase">
        {label}
      </div>
      {loading ? (
        <>
          <SkeletonBlock className="h-[17px] w-20 rounded-md" />
          <SkeletonBlock className="h-3 w-[min(11rem,80%)] rounded-md opacity-60" />
        </>
      ) : (
        <>
          <div className="font-mono text-[17px] leading-none font-medium text-[color:var(--text)] tabular-nums">
            {value}
          </div>
          <div className="truncate text-[12px] text-[color:var(--muted-2)]">{detail}</div>
        </>
      )}
    </div>
  )
}

function TopSessionRow({
  projectId,
  session,
  onOpenThread,
}: {
  projectId: string
  session: ProjectUsageSessionSummary
  onOpenThread: (projectId: string, threadId: string, sessionPath: string) => void
}) {
  return (
    <button
      type="button"
      className="grid min-h-11 w-full min-w-0 grid-cols-[minmax(0,1fr)] items-center gap-1 rounded-lg border border-[rgba(169,178,215,0.08)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-left text-[12px] shadow-[var(--shadow)] transition-colors hover:bg-[rgba(255,255,255,0.04)] active:scale-[0.99] min-[560px]:grid-cols-[minmax(0,1fr)_auto] min-[560px]:gap-4"
      onClick={() => onOpenThread(projectId, session.threadId, session.sessionPath)}
    >
      <span className="min-w-0 truncate text-[13px] font-medium text-[color:var(--text)]">
        {session.title}
      </span>
      <span className="min-w-0 truncate font-mono text-[color:var(--muted)] tabular-nums max-[559px]:justify-self-start">
        {formatCost(session.costTotal)} · {formatTokens(session.totalTokens)}
      </span>
    </button>
  )
}

function TopSessionsSection({
  loading,
  projectId,
  sessions,
  onOpenThread,
}: {
  loading: boolean
  projectId: string
  sessions: ProjectUsageSessionSummary[]
  onOpenThread: (projectId: string, threadId: string, sessionPath: string) => void
}) {
  return (
    <section className="col-span-2 col-start-2 grid gap-2 [@media(max-height:560px)]:hidden">
      <h2 className="m-0 w-[calc(100%-2.5rem)] px-1 text-[13px] font-medium text-[color:var(--text)]">
        Top sessions by cost
      </h2>
      {loading ? (
        <TopSessionsSkeleton />
      ) : sessions.length > 0 ? (
        <div className="grid max-h-[9.75rem] w-full gap-1.5 overflow-y-auto overflow-x-hidden pr-8 [scrollbar-gutter:stable] max-[560px]:max-h-[3.25rem] [@media(max-height:760px)]:max-h-[3.25rem]">
          {sessions.map((session) => (
            <TopSessionRow
              key={session.sessionPath}
              projectId={projectId}
              session={session}
              onOpenThread={onOpenThread}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[rgba(169,178,215,0.12)] px-3 py-4 text-[12px] text-[color:var(--muted)]">
          No usage recorded yet. Start a session below and Pi usage will appear here after the first
          assistant response.
        </div>
      )}
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
}: {
  composerOverlayHeight: number
  project: Project
  gitState: ProjectGitState | null | undefined
  usageLoading: boolean
  usageSummary: ProjectUsageSummary | null | undefined
  onOpenThread: (projectId: string, threadId: string, sessionPath: string) => void
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

        <section className="col-start-2 grid w-full gap-2">
          <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 rounded-xl border border-[rgba(169,178,215,0.08)] bg-[rgba(255,255,255,0.02)] px-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {githubLink ? (
                <Github size={14} className="text-[color:var(--muted)]" aria-hidden="true" />
              ) : (
                <GitBranch size={14} className="text-[color:var(--muted)]" aria-hidden="true" />
              )}
              <span className="min-w-0 truncate text-[13px] font-medium text-[color:var(--text)]">
                {githubLink
                  ? `${githubLink.owner}/${githubLink.repo}`
                  : (gitSummary ?? branchLabel)}
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
                <span className="min-w-0 max-w-[14rem] shrink truncate rounded-full bg-[rgba(169,178,215,0.08)] px-2 py-0.5 text-[11px] text-[color:var(--muted)] max-[900px]:hidden">
                  {branchLabel}
                </span>
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
