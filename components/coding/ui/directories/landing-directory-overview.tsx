import { CircleDot, ExternalLink, GitBranch, GitPullRequest } from 'lucide-react'
import { parseGitHubRepositoryUrl } from '../../../../shared/github-repository-url'
import { GitHubInvertocatMark } from '../../../../src/app/common/github-invertocat-mark'
import type {
  DesktopActionInvoker,
  DirectoryGitState,
  DirectoryUsageSummary,
} from '../../../../src/app/desktop/types'
import { openExternalQuery } from '../../../../src/app/query/desktop-query'
import type { WorkingDirectory } from '../../../../src/app/types'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeDashboardTitleClass,
  appTypeGroupTitleClass,
  appTypeSmallClass,
  ghostButtonClass,
  quietListFrameClass,
} from '../../../../src/app/ui/classes'
import { cn } from '../../../../src/app/utils/cn'
import { DashboardBranchSwitcher } from './directory-overview/dashboard-branch-switcher'
import { DirectoryMetric } from './directory-overview/directory-metric'
import {
  formatAverageCost,
  formatCost,
  formatExactNumber,
  formatTokens,
} from './directory-overview/overview-formatters'
import { TopSessionsSection } from './directory-overview/top-sessions-section'

function formatGitSummary(gitState: DirectoryGitState | null | undefined) {
  if (!gitState) return 'Checking repository…'
  if (!gitState.isGitRepo) return 'Not a Git repository'
  return null
}

function getGitHubRepositoryLink(
  directory: WorkingDirectory,
  gitState: DirectoryGitState | null | undefined,
) {
  const url = gitState === undefined ? (directory.repoOriginUrl ?? null) : gitState?.originUrl
  return url ? parseGitHubRepositoryUrl(url) : null
}

function formatTokenBreakdown(usageSummary: DirectoryUsageSummary | null | undefined) {
  const parts = [
    { label: 'in', value: usageSummary?.input },
    { label: 'out', value: usageSummary?.output },
    { label: 'read', value: usageSummary?.cacheRead },
    { label: 'write', value: usageSummary?.cacheWrite },
  ]
    .filter((part) => part.value !== null && part.value !== undefined && part.value > 0)
    .map((part) => `${formatTokens(part.value)} ${part.label}`)

  return parts.length > 0 ? parts.join(' · ') : 'No token usage yet'
}

function getSafeExternalUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null
  } catch {
    return null
  }
}

async function openExternalUrl(url: string) {
  const safeUrl = getSafeExternalUrl(url)
  if (!safeUrl) return false
  if (await openExternalQuery(safeUrl)) return true
  window.open(safeUrl, '_blank', 'noopener,noreferrer')
  return true
}

function DirectoryRepositorySection({
  branchLabel,
  gitState,
  gitSummary,
  githubLink,
  directory,
  onAction,
}: {
  branchLabel: string
  gitState: DirectoryGitState | null | undefined
  gitSummary: string | null
  githubLink: ReturnType<typeof getGitHubRepositoryLink>
  directory: WorkingDirectory
  onAction: DesktopActionInvoker
}) {
  return (
    <section className="relative z-20 col-start-2 grid w-full gap-2">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-y border-[color:var(--border)]/70 py-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {githubLink ? (
            <button
              type="button"
              className="group/repo inline-flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-[color:var(--surface-hover)] active:scale-[0.99]"
              onClick={() => void openExternalUrl(githubLink.canonicalUrl)}
              aria-label={`Open ${githubLink.owner}/${githubLink.repo} on GitHub`}
            >
              <GitHubInvertocatMark
                size={14}
                className="shrink-0 text-[color:var(--muted)] transition-colors group-hover/repo:text-[color:var(--text)]"
              />
              <span className={`min-w-0 truncate ${appTypeGroupTitleClass} ${appToneTextClass}`}>
                {githubLink.owner}/{githubLink.repo}
              </span>
              <ExternalLink
                size={12}
                className="shrink-0 text-[color:var(--muted)] transition-colors group-hover/repo:text-[color:var(--text)]"
                aria-hidden="true"
              />
            </button>
          ) : (
            <>
              <GitBranch size={14} className="text-[color:var(--muted)]" aria-hidden="true" />
              <span className={`min-w-0 truncate ${appTypeGroupTitleClass} ${appToneTextClass}`}>
                {gitSummary ?? branchLabel}
              </span>
            </>
          )}
          {gitState?.isGitRepo ? (
            <DashboardBranchSwitcher
              branchLabel={branchLabel}
              gitState={gitState}
              directory={directory}
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
              onClick={() => void openExternalUrl(`${githubLink.canonicalUrl}/issues`)}
            >
              <CircleDot size={12} aria-hidden="true" /> Issues
            </button>
            <button
              type="button"
              className={cn(
                ghostButtonClass,
                'inline-flex h-7 items-center gap-1.5 px-2 active:scale-[0.96]',
              )}
              onClick={() => void openExternalUrl(`${githubLink.canonicalUrl}/pulls`)}
            >
              <GitPullRequest size={12} aria-hidden="true" /> PRs
            </button>
          </div>
        ) : null}
      </div>
      {gitSummary ? (
        <div className={`px-1 ${appTypeSmallClass} ${appToneMutedClass}`}>{gitSummary}</div>
      ) : null}
    </section>
  )
}

export function DirectoryOverview({
  composerOverlayHeight,
  directory,
  gitState,
  usageLoading,
  usageSummary,
  onOpenChat,
  onAction,
}: {
  composerOverlayHeight: number
  directory: WorkingDirectory
  gitState: DirectoryGitState | null | undefined
  usageLoading: boolean
  usageSummary: DirectoryUsageSummary | null | undefined
  onOpenChat: (directoryId: string, chatId: string, conversationId: string) => void
  onAction: DesktopActionInvoker
}) {
  const githubLink = getGitHubRepositoryLink(directory, gitState)
  const sessionCount = usageSummary?.sessionCount ?? directory.chatCount ?? directory.chats.length
  const sessionsWithUsageCount = usageSummary?.sessionsWithUsageCount ?? 0
  const branchLabel = gitState?.isGitRepo ? (gitState.branch ?? 'Detached HEAD') : 'No branch'
  const gitSummary = formatGitSummary(gitState)
  const assistantTurnCount = usageSummary?.assistantTurnCount ?? 0
  const measuredComposerHeight = Math.max(composerOverlayHeight, 132)
  const dashboardHeight =
    composerOverlayHeight > 0 ? `calc(60% - ${measuredComposerHeight / 2}px + 0.5rem)` : '100%'
  return (
    <div
      className="mx-auto grid min-h-0 w-full grid-cols-[minmax(2rem,1fr)_minmax(0,800px)_minmax(2rem,1fr)] content-center gap-x-2 overflow-y-auto px-0 text-left [scrollbar-gutter:stable]"
      style={{ height: dashboardHeight }}
    >
      <div className="col-start-2 grid min-h-0 w-full grid-cols-[2rem_minmax(0,1fr)_2rem] content-end gap-x-2 gap-y-3 min-[560px]:gap-y-4 [@media(max-height:660px)]:gap-y-2">
        <div className="col-start-2 grid w-full gap-1.5 [@media(max-height:660px)]:hidden">
          <h1 className={`m-0 ${appTypeDashboardTitleClass} ${appToneTextClass} text-balance`}>
            {directory.name}
          </h1>
          <p className={`m-0 ${appTypeSmallClass} ${appToneMutedClass}`}>
            Chat usage in this folder.
          </p>
        </div>

        <div className="col-start-2 grid w-full grid-cols-[repeat(auto-fit,minmax(118px,1fr))] gap-3 py-3 min-[560px]:gap-4 [@media(max-height:660px)]:py-2">
          <DirectoryMetric
            label="Chats"
            loading={usageLoading}
            value={formatExactNumber(sessionCount)}
            detail={`${formatExactNumber(assistantTurnCount)} turns`}
          />
          <DirectoryMetric
            label="Spend"
            loading={usageLoading}
            value={formatCost(usageSummary?.costTotal)}
            detail={`${formatAverageCost(usageSummary?.costTotal, sessionsWithUsageCount)}/active chat`}
          />
          <DirectoryMetric
            label="Tokens"
            loading={usageLoading}
            value={formatTokens(usageSummary?.totalTokens)}
            detail={formatTokenBreakdown(usageSummary)}
          />
        </div>

        <DirectoryRepositorySection
          branchLabel={branchLabel}
          gitState={gitState}
          gitSummary={gitSummary}
          githubLink={githubLink}
          directory={directory}
          onAction={onAction}
        />

        <TopSessionsSection
          frameClassName={quietListFrameClass}
          loading={usageLoading}
          directoryId={directory.id}
          sessions={usageSummary?.topSessions ?? []}
          onOpenChat={onOpenChat}
        />
      </div>
    </div>
  )
}
