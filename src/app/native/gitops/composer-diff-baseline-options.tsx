import { Check } from 'lucide-react'
import type {
  ProjectCommitEntry,
  ProjectDiffBaseline,
  ProjectDiffStatsResult,
  ProjectGitState,
} from '../../desktop/types'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeControlClass,
  appTypeMetaClass,
  composerPopoverOptionClass,
  composerPopoverOptionSelectedClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'

export const baselineOptions = [
  { key: 'head', label: 'last commit', baseline: { kind: 'head' } },
  { key: 'previous', label: 'prev commit', baseline: { kind: 'previous' } },
  { key: 'dev-branch', label: 'dev branch', baseline: { kind: 'dev-branch' } },
  { key: 'main-branch', label: 'main branch', baseline: { kind: 'main-branch' } },
  { key: 'yesterday', label: 'yesterday', baseline: { kind: 'yesterday' } },
] as const satisfies ReadonlyArray<{
  key: ProjectDiffBaseline['kind']
  label: string
  baseline: Extract<
    ProjectDiffBaseline,
    { kind: 'head' | 'previous' | 'dev-branch' | 'main-branch' | 'yesterday' }
  >
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
    if (input.includeUntracked && input.baselineStats) {
      return {
        fileCount: input.baselineStats.fileCount,
        insertions: input.baselineStats.insertions,
        deletions: input.baselineStats.deletions,
      }
    }
    if (!input.projectGitState) return null
    return {
      fileCount: input.includeUntracked
        ? input.projectGitState.fileCount
        : Math.max(0, input.projectGitState.fileCount - input.projectGitState.untrackedFileCount),
      insertions: input.projectGitState.insertions,
      deletions: input.projectGitState.deletions,
    }
  }
  if (!input.baselineStats) return null
  return {
    fileCount: input.baselineStats.fileCount,
    insertions: input.baselineStats.insertions,
    deletions: input.baselineStats.deletions,
  }
}

export function CommitOption({
  commit,
  selected,
  onSelect,
}: {
  commit: ProjectCommitEntry
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        composerPopoverOptionClass,
        'min-h-10 py-1.5',
        selected && composerPopoverOptionSelectedClass,
      )}
      onClick={onSelect}
      aria-label={`Select ${commit.subject || commit.shortSha}`}
      data-tooltip="Select baseline"
    >
      <span className="inline-flex items-center justify-center text-[color:var(--accent)]">
        {selected ? <Check size={14} /> : null}
      </span>
      <span className="min-w-0">
        <span className={cn('block truncate', appTypeControlClass, appToneTextClass)}>
          {commit.subject || '(no subject)'}
        </span>
        <span className={cn('block truncate', appTypeMetaClass, appToneMutedClass)}>
          {commit.shortSha} · {commit.authorName}
        </span>
      </span>
    </button>
  )
}

export function BaselineOption({
  label,
  selected,
  onSelect,
}: {
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        composerPopoverOptionClass,
        'min-h-8 py-1.5',
        selected && composerPopoverOptionSelectedClass,
      )}
      onClick={onSelect}
    >
      <span className="inline-flex items-center justify-center text-[color:var(--accent)]">
        {selected ? <Check size={14} /> : null}
      </span>
      <span
        className={cn(
          appTypeControlClass,
          selected ? 'text-[color:var(--text)]' : 'text-[color:var(--muted)]',
        )}
      >
        {label}
      </span>
    </button>
  )
}
