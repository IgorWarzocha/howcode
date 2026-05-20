import { useQuery } from '@tanstack/react-query'
import { GitCompareArrows, Search } from 'lucide-react'
import { type RefObject, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  ProjectCommitEntry,
  ProjectDiffBaseline,
  ProjectDiffStatsResult,
  ProjectGitState,
} from '../../../desktop/types'
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

function BaselineSummaryButton({
  baselineLabel,
  baselinePrefix,
  counts,
  deletionCountLabel,
  fileCountLabel,
  insertionCountLabel,
  onOpen,
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
  branchAnchorRef,
  branchSwitchPanelRef,
  branchSwitchInputRef,
  branchSwitchInput,
  branchSwitchOpen,
  open,
  panelId,
  onOpen,
  onSetBranchSwitchInput,
  onSetBranchSwitchOpen,
  onSwitchBranch,
}: {
  branchAnchorRef: RefObject<HTMLButtonElement | null>
  branchSwitchPanelRef: RefObject<HTMLDivElement | null>
  branchSwitchInputRef: RefObject<HTMLInputElement | null>
  branchLabel: string
  branchSwitchInput: string
  branchSwitchOpen: boolean
  onOpen: () => void
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
    onSetBranchSwitchInput(branchLabel === 'Detached' ? '' : branchLabel)
    onSetBranchSwitchOpen(true)
  }

  const submitBranchSwitch = () => {
    const nextBranch = branchSwitchInput.trim()
    if (!nextBranch) return
    onSwitchBranch?.(nextBranch)
    onSetBranchSwitchOpen(false)
  }

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
      >
        <span className="truncate">{branchLabel}</span>
      </button>
      {branchSwitchOpen ? (
        <SurfacePanel
          ref={branchSwitchPanelRef}
          className="motion-popover absolute right-0 bottom-[calc(100%+0.35rem)] z-[140] grid w-64 gap-2 rounded-xl p-2"
        >
          <div className="px-1 text-[11px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
            Switch branch
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
            placeholder="branch-name"
          />
        </SurfacePanel>
      ) : null}
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
  const baselinePrefix = getDiffBaselinePrefix(selectedBaseline)

  const visibleCommits = useMemo(() => {
    const nextCommits =
      searchQuery.trim().length > 0
        ? commits.filter((commit) => matchesCommitSearch(commit, searchQuery))
        : commits

    return nextCommits.slice(0, 5)
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

  const closePopover = () => setOpen(false)
  const togglePopover = (anchor: 'summary' | 'branch' | 'compact') => {
    activeAnchorRef.current = anchor
    setOpen((current) => !current)
  }

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
      branchSwitchInputRef.current?.select()
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
        onOpen={() => togglePopover('summary')}
      />
      {showBranchChip ? (
        <BaselineBranchButton
          branchAnchorRef={branchAnchorRef}
          branchSwitchInputRef={branchSwitchInputRef}
          branchSwitchInput={branchSwitchInput}
          branchSwitchOpen={branchSwitchOpen}
          branchSwitchPanelRef={branchSwitchPanelRef}
          branchLabel={branchLabel}
          open={open}
          panelId={panelId}
          onOpen={() => togglePopover('branch')}
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
        onClick={() => togglePopover('compact')}
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
