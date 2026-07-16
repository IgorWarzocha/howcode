import type {
  ProjectCommitEntry,
  ProjectDiffBaseline,
  ProjectDiffStatsResult,
  ProjectGitState,
} from '../../desktop/types'

export const baselineOptions = [
  { key: 'head', label: 'last commit', baseline: { kind: 'head' } },
  { key: 'previous', label: 'prev commit', baseline: { kind: 'previous' } },
] as const satisfies ReadonlyArray<{
  key: ProjectDiffBaseline['kind']
  label: string
  baseline: Extract<ProjectDiffBaseline, { kind: 'head' | 'previous' }>
}>

export function matchesCommitSearch(commit: ProjectCommitEntry, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (normalizedQuery.length === 0) return true
  return [commit.subject, commit.sha, commit.shortSha, commit.authorName, commit.authorEmail].some(
    (value) => value.toLowerCase().includes(normalizedQuery),
  )
}

export function getBaselineCounts(input: {
  baselineStats: ProjectDiffStatsResult | null | undefined
  includeUntracked: boolean
  projectGitState: ProjectGitState | null
  selectedBaseline: ProjectDiffBaseline
}) {
  if (input.selectedBaseline.kind === 'head') {
    if (input.includeUntracked && input.baselineStats) return input.baselineStats
    if (!input.projectGitState) return null
    return {
      fileCount: input.includeUntracked
        ? input.projectGitState.fileCount
        : Math.max(0, input.projectGitState.fileCount - input.projectGitState.untrackedFileCount),
      insertions: input.projectGitState.insertions,
      deletions: input.projectGitState.deletions,
    }
  }
  return input.baselineStats ?? null
}
