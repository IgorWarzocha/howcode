import { useQuery } from '@tanstack/react-query'
import { Check, GitCompareArrows, GitPullRequestDraft, Search } from 'lucide-react'
import { type RefObject, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  ProjectCommitEntry,
  ProjectDiffBaseline,
  ProjectDiffStatsResult,
  ProjectGitState,
} from '../../../desktop/types'
import {
  getFeatureStatusBadgeClass,
  getFeatureStatusDataAttributes,
} from '../../../features/feature-status'
import { useDismissibleLayer } from '../../../hooks/useDismissibleLayer'
import {
  desktopQueryKeys,
  getProjectDiffStatsQuery,
  listProjectCommitsQuery,
} from '../../../query/desktop-query'
import { popoverPanelClass, settingsInputClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { SurfacePanel } from '../../common/surface-panel'
import {
  BaselineOption,
  baselineOptions,
  CommitOption,
  getBaselineCounts,
  matchesCommitSearch,
} from './composer-diff-baseline-options'
import { getDiffBaselineLabel, getDiffBaselinePrefix } from './diff-baseline'
import { formatGitCount } from './git-ops'
import {
  type BaselineAnchorKind,
  useDiffBaselinePopoverPosition,
} from './useDiffBaselinePopoverPosition'

type ComposerDiffBaselineSelectorProps = {
  composerPanelRef: RefObject<HTMLDivElement | null>
  projectId: string
  projectGitState: ProjectGitState | null
  branch?: string | null
  selectedBaseline: ProjectDiffBaseline
  onSelectBaseline: (baseline: ProjectDiffBaseline) => void
  onSwitchBranch?: ((branchName: string) => void) | undefined
}

function useComposerBaselinePopoverControls({
  activeAnchorRef,
  branchSwitchOpen,
  canSwitchBranch,
  open,
  setBranchSwitchInput,
  setBranchSwitchOpen,
  setOpen,
}: {
  activeAnchorRef: RefObject<BaselineAnchorKind>
  branchSwitchOpen: boolean
  canSwitchBranch: boolean
  open: boolean
  setBranchSwitchInput: (input: string) => void
  setBranchSwitchOpen: (open: boolean) => void
  setOpen: (open: boolean | ((current: boolean) => boolean)) => void
}) {
  const closePopover = () => setOpen(false)
  const openBaselinePopover = (anchor: 'summary' | 'branch' | 'compact') => {
    activeAnchorRef.current = anchor
    setBranchSwitchOpen(false)
    setOpen(true)
  }
  const toggleBaselinePopover = (anchor: 'summary' | 'branch' | 'compact') => {
    activeAnchorRef.current = anchor
    setBranchSwitchOpen(false)
    setOpen((current) => !current)
  }
  const openBranchSwitchPopover = () => {
    if (!canSwitchBranch) {
      openBaselinePopover('branch')
      return
    }

    activeAnchorRef.current = 'branch'
    setOpen(false)
    setBranchSwitchInput('')
    setBranchSwitchOpen(true)
  }
  const previewBaselinePopover = (anchor: 'summary' | 'branch') => {
    ;(open || branchSwitchOpen) && openBaselinePopover(anchor)
  }
  const previewBranchSwitchPopover = () => {
    ;(open || branchSwitchOpen) && openBranchSwitchPopover()
  }

  return {
    closePopover,
    openBranchSwitchPopover,
    previewBaselinePopover,
    previewBranchSwitchPopover,
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
}: {
  open: boolean
  projectGitState: ProjectGitState | null
  projectId: string
  searchQuery: string
  selectedBaseline: ProjectDiffBaseline
}) {
  const commitsQuery = useQuery<ProjectCommitEntry[]>({
    queryKey: desktopQueryKeys.projectCommits(projectId, 100),
    queryFn: () => listProjectCommitsQuery(projectId, 100),
    enabled: open && projectId.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
  })
  const baselineStatsQuery = useQuery<ProjectDiffStatsResult | null, Error>({
    queryKey: projectId
      ? desktopQueryKeys.projectDiffStats(projectId, selectedBaseline)
      : ['desktop', 'projectDiffStats', null],
    queryFn: () =>
      projectId ? getProjectDiffStatsQuery(projectId, selectedBaseline) : Promise.resolve(null),
    enabled: projectId.length > 0 && selectedBaseline.kind !== 'head',
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
        projectGitState,
        selectedBaseline,
      }),
    [baselineStatsQuery.data, projectGitState, selectedBaseline],
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
        'composer-diff-summary composer-footer-text group relative inline-flex h-7 min-w-[9.5rem] items-center justify-end overflow-hidden rounded-lg px-2 text-right text-[color:var(--muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]',
        open && 'text-[color:var(--text)]',
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
            counts && counts.insertions > 0 ? 'text-[#7ee0bb]' : 'text-[color:var(--muted)]',
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
          'composer-footer-text pointer-events-none absolute inset-0 flex h-full items-center justify-end truncate px-2 text-[color:var(--text)] transition-opacity duration-150 ease-out',
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
  branches,
  branchAnchorRef,
  branchSwitchPanelRef,
  branchSwitchInputRef,
  branchSwitchInput,
  branchSwitchOpen,
  open,
  panelId,
  panelPosition,
  positionReady,
  onOpen,
  onPreview,
  onSetBranchSwitchInput,
  onSetBranchSwitchOpen,
  onSwitchBranch,
}: {
  branchAnchorRef: RefObject<HTMLButtonElement | null>
  branchSwitchPanelRef: RefObject<HTMLDivElement | null>
  branchSwitchInputRef: RefObject<HTMLInputElement | null>
  branchLabel: string
  branches: readonly string[]
  branchSwitchInput: string
  branchSwitchOpen: boolean
  onOpen: () => void
  onPreview: () => void
  panelPosition: { left: number; bottom: number; width: number; maxHeight: number }
  positionReady: boolean
  onSetBranchSwitchInput: (value: string) => void
  onSetBranchSwitchOpen: (open: boolean) => void
  onSwitchBranch?: ((branchName: string) => void) | undefined
  open: boolean
  panelId: string
}) {
  const openBranchSwitch = () => {
    if (!onSwitchBranch) {
      onOpen()
      return
    }

    onOpen()
  }

  const submitBranchSwitch = () => {
    const nextBranch = branchSwitchInput.trim()
    if (!(nextBranch && onSwitchBranch)) return
    onSwitchBranch(nextBranch)
    onSetBranchSwitchOpen(false)
  }
  const filteredBranches = branches.filter((branch) =>
    branch.toLowerCase().includes(branchSwitchInput.trim().toLowerCase()),
  )
  const visibleBranches = filteredBranches.slice(0, 5)

  return (
    <span className="relative inline-flex">
      <button
        ref={branchAnchorRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open || branchSwitchOpen}
        aria-controls={open ? panelId : undefined}
        className={cn(
          'composer-branch-chip composer-footer-text pointer-events-auto relative z-20 inline-flex h-7 max-w-[12rem] cursor-pointer select-none items-center rounded-lg border border-transparent px-2.5 py-0 text-[color:var(--muted)] transition-colors duration-150 hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
          (open || branchSwitchOpen) &&
            'border-[color:var(--border)] bg-[color:var(--surface-hover)] text-[color:var(--text)]',
        )}
        onPointerDownCapture={(event) => {
          event.preventDefault()
          event.stopPropagation()
          openBranchSwitch()
        }}
        onClick={openBranchSwitch}
        onMouseEnter={onPreview}
      >
        <span className="truncate">{branchLabel}</span>
      </button>
      {branchSwitchOpen && typeof document !== 'undefined'
        ? createPortal(
            <SurfacePanel
              id={panelId}
              ref={branchSwitchPanelRef}
              data-open={positionReady ? 'true' : 'false'}
              aria-label="Branch selector"
              className={cn(
                popoverPanelClass,
                'motion-popover fixed z-[160] grid max-h-[calc(100vh-1rem)] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-2 rounded-2xl p-2 transition-[opacity,transform] duration-150 ease-out',
                positionReady
                  ? 'translate-y-0 opacity-100'
                  : 'pointer-events-none translate-y-1 opacity-0',
              )}
              style={{
                bottom: `${panelPosition.bottom}px`,
                left: `${panelPosition.left}px`,
                maxHeight: `${panelPosition.maxHeight}px`,
                width: `${panelPosition.width}px`,
              }}
            >
              <div className="px-1 text-[11px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                Switch branch
              </div>
              <div className="grid min-h-0 gap-0.5 overflow-y-auto pb-0.5">
                {visibleBranches.length > 0 ? (
                  visibleBranches.map((branch) => (
                    <button
                      key={branch}
                      type="button"
                      className={cn(
                        'grid min-h-9 w-full grid-cols-[16px_minmax(0,1fr)] items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[12.5px] text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]',
                        branch === branchLabel &&
                          'bg-[rgba(255,255,255,0.06)] text-[color:var(--text)]',
                      )}
                      onClick={() => {
                        if (!onSwitchBranch) return
                        onSwitchBranch(branch)
                        onSetBranchSwitchOpen(false)
                      }}
                    >
                      <span className="inline-flex items-center justify-center text-[color:var(--accent)]">
                        {branch === branchLabel ? <Check size={13} /> : null}
                      </span>
                      <span className="truncate">{branch}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-[12px] text-[color:var(--muted)]">
                    Press Enter to check out “{branchSwitchInput.trim()}”
                  </div>
                )}
              </div>
              <input
                ref={branchSwitchInputRef}
                value={branchSwitchInput}
                onChange={(event) => onSetBranchSwitchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitBranchSwitch()
                  if (event.key === 'Escape') onSetBranchSwitchOpen(false)
                }}
                className={settingsInputClass}
                placeholder="Search branches"
              />
              <div
                className="grid min-h-[92px] gap-2 rounded-xl border border-dashed border-[color:var(--border)] bg-[rgba(255,255,255,0.025)] p-3"
                {...getFeatureStatusDataAttributes('feature:composer.worktrees')}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--panel-2)] text-[color:var(--muted)]">
                      <GitPullRequestDraft size={14} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[12.5px] font-medium text-[color:var(--text)]">
                        Worktrees
                      </div>
                      <div className="truncate text-[11px] text-[color:var(--muted)]">
                        Reserved for linked branch workspaces.
                      </div>
                    </div>
                  </div>
                  <span className={getFeatureStatusBadgeClass('feature:composer.worktrees')}>
                    Mock
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[color:var(--muted)]">
                  <div className="rounded-lg border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-2 py-1.5">
                    Create worktree
                  </div>
                  <div className="rounded-lg border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-2 py-1.5">
                    Open existing
                  </div>
                </div>
              </div>
            </SurfacePanel>,
            document.body,
          )
        : null}
    </span>
  )
}

function BaselineSelectorPortal({
  commitsQuery,
  panelId,
  panelPosition,
  panelRef,
  positionReady,
  searchQuery,
  selectedBaseline,
  selectedCommitSha,
  setOpen,
  setSearchQuery,
  visibleCommits,
  onSelectBaseline,
}: {
  commitsQuery: ReturnType<typeof useQuery<ProjectCommitEntry[]>>
  onSelectBaseline: (baseline: ProjectDiffBaseline) => void
  panelId: string
  panelPosition: { left: number; bottom: number; width: number; maxHeight: number }
  panelRef: RefObject<HTMLDivElement | null>
  positionReady: boolean
  searchQuery: string
  selectedBaseline: ProjectDiffBaseline
  selectedCommitSha: string | null
  setOpen: (open: boolean) => void
  setSearchQuery: (query: string) => void
  visibleCommits: ProjectCommitEntry[]
}) {
  if (typeof document === 'undefined') return null
  const panelLeft = `${panelPosition.left}px`
  const panelWidth = `${panelPosition.width}px`
  return createPortal(
    <SurfacePanel
      id={panelId}
      ref={panelRef}
      data-open={positionReady ? 'true' : 'false'}
      aria-label="Diff baseline selector"
      className={cn(
        popoverPanelClass,
        'motion-popover fixed z-[120] grid max-h-[calc(100vh-1rem)] grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-2 rounded-2xl p-2 transition-[opacity,transform] duration-150 ease-out',
        positionReady ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-1',
      )}
      style={{
        bottom: `${panelPosition.bottom}px`,
        left: panelLeft,
        maxHeight: `${panelPosition.maxHeight}px`,
        width: panelWidth,
      }}
    >
      <div className="px-2 pt-1 text-[11px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
        Changes since
      </div>
      <div className="grid min-h-0 gap-0.5 overflow-y-auto pb-0.5">
        {visibleCommits.length > 0 ? (
          visibleCommits.map((commit) => (
            <CommitOption
              key={commit.sha}
              commit={commit}
              selected={selectedCommitSha === commit.sha}
              onSelect={() => {
                onSelectBaseline({ kind: 'commit', sha: commit.sha })
                setOpen(false)
              }}
            />
          ))
        ) : (
          <div className="px-2.5 py-3 text-[12px] text-[color:var(--muted)]">
            {commitsQuery.isLoading ? 'Loading commits…' : 'No commits found.'}
          </div>
        )}
      </div>
      <label className="relative block">
        <Search
          size={14}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[color:var(--muted)]"
        />
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search commits"
          className={cn(settingsInputClass, 'w-full pl-9')}
        />
      </label>
      {baselineOptions.map((option) => (
        <BaselineOption
          key={option.key}
          label={option.label}
          selected={selectedBaseline.kind === option.key}
          onSelect={() => {
            onSelectBaseline(option.baseline)
            setOpen(false)
          }}
        />
      ))}
    </SurfacePanel>,
    document.body,
  )
}

export function ComposerDiffBaselineSelector({
  composerPanelRef,
  projectId,
  projectGitState,
  branch,
  selectedBaseline,
  onSelectBaseline,
  onSwitchBranch,
}: ComposerDiffBaselineSelectorProps) {
  const [open, setOpen] = useState(false)
  const [branchSwitchOpen, setBranchSwitchOpen] = useState(false)
  const [branchSwitchInput, setBranchSwitchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const panelId = useId()
  const anchorRef = useRef<HTMLButtonElement>(null)
  const branchAnchorRef = useRef<HTMLButtonElement>(null)
  const branchSwitchPanelRef = useRef<HTMLDivElement>(null)
  const branchSwitchInputRef = useRef<HTMLInputElement>(null)
  const compactAnchorRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const activeAnchorRef = useRef<BaselineAnchorKind>('summary')

  const { baselineLabel, commitsQuery, counts, selectedCommitSha, visibleCommits } =
    useComposerBaselineData({
      open,
      projectGitState,
      projectId,
      searchQuery,
      selectedBaseline,
    })
  const baselinePrefix = getDiffBaselinePrefix(selectedBaseline)

  const {
    closePopover,
    openBranchSwitchPopover,
    previewBaselinePopover,
    previewBranchSwitchPopover,
    toggleBaselinePopover,
  } = useComposerBaselinePopoverControls({
    activeAnchorRef,
    branchSwitchOpen,
    canSwitchBranch: Boolean(onSwitchBranch),
    open,
    setBranchSwitchInput,
    setBranchSwitchOpen,
    setOpen,
  })

  useDismissibleLayer({
    open: open || branchSwitchOpen,
    onDismiss: () => {
      closePopover()
      setBranchSwitchOpen(false)
    },
    refs: [anchorRef, branchAnchorRef, branchSwitchPanelRef, compactAnchorRef, panelRef],
  })

  useEffect(() => {
    if (!branchSwitchOpen) return
    window.requestAnimationFrame(() => {
      branchSwitchInputRef.current?.focus()
    })
  }, [branchSwitchOpen])

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
    open: open || branchSwitchOpen,
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
          branchSwitchInputRef={branchSwitchInputRef}
          branchSwitchInput={branchSwitchInput}
          branchSwitchOpen={branchSwitchOpen}
          branchSwitchPanelRef={branchSwitchPanelRef}
          branches={projectGitState?.branches ?? []}
          branchLabel={branchLabel}
          open={open}
          panelId={panelId}
          panelPosition={panelPosition}
          positionReady={positionReady}
          onOpen={openBranchSwitchPopover}
          onPreview={previewBranchSwitchPopover}
          onSetBranchSwitchInput={setBranchSwitchInput}
          onSetBranchSwitchOpen={setBranchSwitchOpen}
          onSwitchBranch={onSwitchBranch}
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
          setOpen={setOpen}
          setSearchQuery={setSearchQuery}
          visibleCommits={visibleCommits}
          onSelectBaseline={onSelectBaseline}
        />
      ) : null}
    </>
  )
}
