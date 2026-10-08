import type {
  DirectoryCommitEntry,
  DirectoryDiffBaseline,
  DirectoryDiffStatsResult,
  DirectoryGitState,
} from '../../../../src/app/desktop/types'

export const baselineOptions = [
  { key: 'head', label: 'last commit', baseline: { kind: 'head' } },
  { key: 'previous', label: 'prev commit', baseline: { kind: 'previous' } },
] as const satisfies ReadonlyArray<{
  key: DirectoryDiffBaseline['kind']
  label: string
  baseline: Extract<DirectoryDiffBaseline, { kind: 'head' | 'previous' }>
}>

export function matchesCommitSearch(commit: DirectoryCommitEntry, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (normalizedQuery.length === 0) return true
  return [commit.subject, commit.sha, commit.shortSha, commit.authorName, commit.authorEmail].some(
    (value) => value.toLowerCase().includes(normalizedQuery),
  )
}

export function getBaselineCounts(input: {
  baselineStats: DirectoryDiffStatsResult | null | undefined
  includeUntracked: boolean
  directoryGitState: DirectoryGitState | null
  selectedBaseline: DirectoryDiffBaseline
}) {
  if (input.selectedBaseline.kind === 'head') {
    if (input.includeUntracked && input.baselineStats) return input.baselineStats
    if (!input.directoryGitState) return null
    return {
      fileCount: input.includeUntracked
        ? input.directoryGitState.fileCount
        : Math.max(
            0,
            input.directoryGitState.fileCount - input.directoryGitState.untrackedFileCount,
          ),
      insertions: input.directoryGitState.insertions,
      deletions: input.directoryGitState.deletions,
    }
  }
  return input.baselineStats ?? null
}
