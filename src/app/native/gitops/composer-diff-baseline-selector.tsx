import { useQuery } from '@tanstack/react-query'
import { GitCompareArrows } from 'lucide-react'
import { type RefObject, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  notifyComposerPopoverOpened,
  useComposerPopoverDismissSignal,
} from '../../composer/composer-popover-coordination'
import {
  type BaselineAnchorKind,
  useDiffBaselinePopoverPosition,
} from '../../composer/useDiffBaselinePopoverPosition'
import type {
  ProjectCommitEntry,
  ProjectDiffBaseline,
  ProjectDiffStatsResult,
  ProjectGitState,
} from '../../desktop/types'
import { useDismissibleLayer } from '../../hooks/useDismissibleLayer'
import {
  desktopQueryKeys,
  getProjectDiffStatsQuery,
  listProjectCommitsQuery,
} from '../../query/desktop-query'
import { cn } from '../../utils/cn'
import { getBaselineCounts, matchesCommitSearch } from './composer-diff-baseline-options'
import { getDiffBaselineLabel, getDiffBaselinePrefix } from './diff-baseline'
import { BaselineSelectorPortal } from './diff-baseline-selector/baseline-selector-popover'
import { formatGitCount } from './git-ops'

type ComposerDiffBaselineSelectorProps = {
  composerPanelRef: RefObject<HTMLDivElement | null>
  projectId: string
  projectGitState: ProjectGitState | null
  branch?: string | null
  parentBranchName?: string | null | undefined
  selectedBaseline: ProjectDiffBaseline
  includeUntracked?: boolean
  onSelectBaseline: (baseline: ProjectDiffBaseline) => void
}

function useComposerBaselinePopoverControls({
  activeAnchorRef,
  open,
  setOpen,
}: {
  activeAnchorRef: RefObject<BaselineAnchorKind>
  open: boolean
  setOpen: (open: boolean | ((current: boolean) => boolean)) => void
}) {
  const closePopover = () => setOpen(false)
  const openBaselinePopover = (anchor: 'summary' | 'branch' | 'compact') => {
    notifyComposerPopoverOpened('diff-baseline')
    activeAnchorRef.current = anchor
    setOpen(true)
  }
  const toggleBaselinePopover = (anchor: 'summary' | 'branch' | 'compact') => {
    activeAnchorRef.current = anchor
    setOpen((current) => {
      if (current) return false
      notifyComposerPopoverOpened('diff-baseline')
      return true
    })
  }
  const previewBaselinePopover = (anchor: 'summary' | 'branch') => {
    open && openBaselinePopover(anchor)
  }

  return {
    closePopover,
    previewBaselinePopover,
    toggleBaselinePopover,
  }
}

function getVisibleBaselineCommits(commits: ProjectCommitEntry[], searchQuery: string) {
  const trimmedSearchQuery = searchQuery.trim()
  const nextCommits = trimmedSearchQuery
    ? commits.filter((commit) => matchesCommitSearch(commit, trimmedSearchQuery))
    : commits

  return nextCommits.slice(0, 5)
}

function useComposerBaselineData({
  open,
  projectGitState,
  projectId,
  searchQuery,
  selectedBaseline,
  includeUntracked = false,
}: {
  open: boolean
  projectGitState: ProjectGitState | null
  projectId: string
  searchQuery: string
  selectedBaseline: ProjectDiffBaseline
  includeUntracked?: boolean
}) {
  const commitsQuery = useQuery<ProjectCommitEntry[]>({
    queryKey: desktopQueryKeys.projectCommits(projectId, 100),
    queryFn: () => listProjectCommitsQuery(projectId, 100),
    enabled: open && projectId.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
  })
  const baselineStatsQuery = useQuery<ProjectDiffStatsResult | null, Error>({
    queryKey: projectId
      ? desktopQueryKeys.projectDiffStats(projectId, selectedBaseline, includeUntracked)
      : ['desktop', 'projectDiffStats', null],
    queryFn: () =>
      projectId
        ? getProjectDiffStatsQuery(projectId, selectedBaseline, includeUntracked)
        : Promise.resolve(null),
    enabled: projectId.length > 0 && (selectedBaseline.kind !== 'head' || includeUntracked),
    staleTime: Number.POSITIVE_INFINITY,
  })

  const commits = commitsQuery.data ?? []
  const selectedCommitSha = selectedBaseline.kind === 'commit' ? selectedBaseline.sha : null
  const baselineLabel = useMemo(
    () => getDiffBaselineLabel(selectedBaseline, commits),
    [commits, selectedBaseline],
  )
  const visibleCommits = useMemo(() => {
    return getVisibleBaselineCommits(commits, searchQuery)
  }, [commits, searchQuery])
  const counts = useMemo(
    () =>
      getBaselineCounts({
        baselineStats: baselineStatsQuery.data,
        includeUntracked,
        projectGitState,
        selectedBaseline,
      }),
    [baselineStatsQuery.data, includeUntracked, projectGitState, selectedBaseline],
  )

  return {
    baselineLabel,
    commitsQuery,
    counts,
    selectedCommitSha,
    visibleCommits,
  }
}

function BaselineSummaryButton({
  baselineLabel,
  baselinePrefix,
  counts,
  deletionCountLabel,
  fileCountLabel,
  insertionCountLabel,
  onOpen,
  onPreview,
  open,
  anchorRef,
}: {
  anchorRef: RefObject<HTMLButtonElement | null>
  baselineLabel: string
  baselinePrefix: string
  counts: ReturnType<typeof getBaselineCounts>
  deletionCountLabel: string
  fileCountLabel: string
  insertionCountLabel: string
  onOpen: () => void
  onPreview: () => void
  open: boolean
}) {
  return (
    <button
      ref={anchorRef}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      className={cn(
        'composer-diff-summary composer-footer-text group relative inline-flex h-7 min-w-[9.5rem] items-center justify-end overflow-hidden rounded-lg px-2 text-right text-[color:var(--muted)] transition-colors duration-150 hover:bg-[color:var(--surface-hover)]',
        open && 'bg-[color:var(--surface-hover)] text-[color:var(--text)]',
      )}
      onClick={onOpen}
      onMouseEnter={onPreview}
    >
      <span
        className={cn(
          'flex h-full items-center gap-2 transition-opacity duration-150 ease-out',
          open ? 'opacity-0' : 'group-hover:opacity-0',
        )}
      >
        <span className="inline-flex h-full items-center text-[color:var(--muted)]">
          {fileCountLabel} files
        </span>
        <span
          className={cn(
            'inline-flex h-full items-center',
            counts && counts.insertions > 0
              ? 'text-[color:color-mix(in_srgb,var(--green)_82%,var(--muted))]'
              : 'text-[color:var(--muted)]',
          )}
        >
          +{insertionCountLabel}
        </span>
        <span
          className={cn(
            'inline-flex h-full items-center',
            counts && counts.deletions > 0
              ? 'text-[color:var(--danger)]'
              : 'text-[color:var(--muted)]',
          )}
        >
          -{deletionCountLabel}
        </span>
      </span>
      <span
        className={cn(
          'composer-footer-text pointer-events-none absolute inset-0 flex h-full items-center justify-end truncate px-2 text-[color:var(--muted)] transition-opacity duration-150 ease-out',
          open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        {baselinePrefix} {baselineLabel}
      </span>
    </button>
  )
}

function BaselineBranchButton({
  branchLabel,
  branchAnchorRef,
  open,
  panelId,
  onOpen,
  onPreview,
}: {
  branchAnchorRef: RefObject<HTMLButtonElement | null>
  branchLabel: string
  onOpen: () => void
  onPreview: () => void
  open: boolean
  panelId: string
}) {
  return (
    <span className="relative inline-flex">
      <button
        ref={branchAnchorRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={cn(
          'composer-branch-chip composer-footer-text pointer-events-auto relative z-20 inline-flex h-7 max-w-[12rem] cursor-pointer select-none items-center rounded-lg px-2.5 py-0 text-[color:var(--muted)] transition-colors duration-150 hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
          open && 'bg-[color:var(--surface-hover)] text-[color:var(--text)]',
        )}
        onPointerDownCapture={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onOpen()
        }}
        onMouseEnter={onPreview}
      >
        <span className="truncate">{branchLabel}</span>
      </button>
    </span>
  )
}

export function ComposerDiffBaselineSelector({
  composerPanelRef,
  projectId,
  projectGitState,
  branch,
  parentBranchName,
  selectedBaseline,
  onSelectBaseline,
  includeUntracked = false,
}: ComposerDiffBaselineSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const panelId = useId()
  const anchorRef = useRef<HTMLButtonElement>(null)
  const branchAnchorRef = useRef<HTMLButtonElement>(null)
  const compactAnchorRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const activeAnchorRef = useRef<BaselineAnchorKind>('summary')

  useComposerPopoverDismissSignal({
    ignoreSource: 'diff-baseline',
    onDismiss: () => {
      setOpen(false)
    },
  })

  const { baselineLabel, commitsQuery, counts, selectedCommitSha, visibleCommits } =
    useComposerBaselineData({
      open,
      projectGitState,
      projectId,
      searchQuery,
      selectedBaseline,
      includeUntracked,
    })
  const baselinePrefix = getDiffBaselinePrefix(selectedBaseline)

  const { closePopover, previewBaselinePopover, toggleBaselinePopover } =
    useComposerBaselinePopoverControls({
      activeAnchorRef,
      open,
      setOpen,
    })

  useDismissibleLayer({
    open,
    onDismiss: () => {
      closePopover()
    },
    refs: [anchorRef, branchAnchorRef, compactAnchorRef, panelRef],
  })

  useEffect(() => {
    if (!open) {
      setSearchQuery('')
    }
  }, [open])

  const { panelPosition, positionReady } = useDiffBaselinePopoverPosition({
    activeAnchorRef,
    anchorRef,
    branchAnchorRef,
    compactAnchorRef,
    composerPanelRef,
    open,
  })

  const fileCountLabel = counts ? formatGitCount(counts.fileCount) : '…'
  const insertionCountLabel = counts ? formatGitCount(counts.insertions) : '…'
  const deletionCountLabel = counts ? formatGitCount(counts.deletions) : '…'
  const showBranchChip = branch !== undefined
  const branchLabel = branch ?? 'Detached'

  return (
    <>
      <BaselineSummaryButton
        anchorRef={anchorRef}
        baselineLabel={baselineLabel}
        baselinePrefix={baselinePrefix}
        counts={counts}
        deletionCountLabel={deletionCountLabel}
        fileCountLabel={fileCountLabel}
        insertionCountLabel={insertionCountLabel}
        open={open}
        onOpen={() => toggleBaselinePopover('summary')}
        onPreview={() => previewBaselinePopover('summary')}
      />
      {showBranchChip ? (
        <BaselineBranchButton
          branchAnchorRef={branchAnchorRef}
          branchLabel={branchLabel}
          open={open}
          panelId={panelId}
          onOpen={() => toggleBaselinePopover('branch')}
          onPreview={() => previewBaselinePopover('branch')}
        />
      ) : null}
      <button
        ref={compactAnchorRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={cn(
          'composer-baseline-compact-trigger hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[color:var(--muted)] transition-colors duration-150 hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
          open && 'bg-[color:var(--surface-hover)] text-[color:var(--text)]',
        )}
        onClick={() => toggleBaselinePopover('compact')}
        aria-label="Diff baseline selector"
        data-tooltip="Diff baseline"
      >
        <GitCompareArrows size={14} />
      </button>
      {open ? (
        <BaselineSelectorPortal
          commitsQuery={commitsQuery}
          panelId={panelId}
          panelPosition={panelPosition}
          panelRef={panelRef}
          positionReady={positionReady}
          searchQuery={searchQuery}
          selectedBaseline={selectedBaseline}
          selectedCommitSha={selectedCommitSha}
          parentBranchName={parentBranchName}
          defaultBranchName={projectGitState?.defaultBranchName}
          devBranchName={projectGitState?.devBranchName}
          mainBranchName={projectGitState?.mainBranchName}
          setOpen={setOpen}
          setSearchQuery={setSearchQuery}
          visibleCommits={visibleCommits}
          onSelectBaseline={onSelectBaseline}
        />
      ) : null}
    </>
  )
}
