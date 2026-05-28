import type { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import { PopoverPanel } from '../../../common/popover'
import type { ProjectCommitEntry, ProjectDiffBaseline } from '../../../desktop/types'
import {
  appToneMutedClass,
  appTypeSmallClass,
  composerPopoverBottomRowLayerClass,
  composerPopoverInputClass,
  composerPopoverSectionLabelClass,
  popoverPanelClass,
} from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { BaselineOption, baselineOptions, CommitOption } from '../composer-diff-baseline-options'

type BaselineSelectorPanelPosition = {
  left: number
  bottom: number
  width: number
  maxHeight: number
}

function getCommitMeta(commit: ProjectCommitEntry | undefined) {
  if (!commit) return null
  return `${commit.shortSha} · ${commit.subject || '(no subject)'}`
}

function BranchBaselineOptions({
  defaultBranchName,
  devBranchName,
  mainBranchName,
  parentBranchName,
  selectedBaseline,
  setOpen,
  onSelectBaseline,
}: {
  defaultBranchName?: string | null | undefined
  devBranchName?: string | null | undefined
  mainBranchName?: string | null | undefined
  parentBranchName?: string | null | undefined
  selectedBaseline: ProjectDiffBaseline
  setOpen: (open: boolean) => void
  onSelectBaseline: (baseline: ProjectDiffBaseline) => void
}) {
  const defaultIsDev = defaultBranchName === 'dev'
  const showDevBranch = Boolean(devBranchName && !defaultIsDev)
  const showMainBranch = Boolean(
    mainBranchName && defaultIsDev && mainBranchName !== defaultBranchName,
  )

  return (
    <>
      {showMainBranch && mainBranchName ? (
        <BaselineOption
          label="main branch"
          meta={mainBranchName}
          selected={
            selectedBaseline.kind === 'branch' && selectedBaseline.branchName === mainBranchName
          }
          onSelect={() => {
            onSelectBaseline({ kind: 'branch', branchName: mainBranchName })
            setOpen(false)
          }}
        />
      ) : null}
      {showDevBranch && devBranchName ? (
        <BaselineOption
          label="dev branch"
          meta={devBranchName}
          selected={selectedBaseline.kind === 'dev-branch'}
          onSelect={() => {
            onSelectBaseline({ kind: 'dev-branch' })
            setOpen(false)
          }}
        />
      ) : null}
      {defaultBranchName ? (
        <BaselineOption
          label="default branch"
          meta={defaultBranchName}
          selected={selectedBaseline.kind === 'main-branch'}
          onSelect={() => {
            onSelectBaseline({ kind: 'main-branch' })
            setOpen(false)
          }}
        />
      ) : null}
      {parentBranchName ? (
        <BaselineOption
          label="parent branch"
          meta={parentBranchName}
          selected={
            selectedBaseline.kind === 'parent-branch' &&
            selectedBaseline.branchName === parentBranchName
          }
          onSelect={() => {
            onSelectBaseline({ kind: 'parent-branch', branchName: parentBranchName })
            setOpen(false)
          }}
        />
      ) : null}
    </>
  )
}

export function BaselineSelectorPortal({
  commitsQuery,
  panelId,
  panelPosition,
  panelRef,
  positionReady,
  searchQuery,
  selectedBaseline,
  selectedCommitSha,
  parentBranchName,
  defaultBranchName,
  devBranchName,
  mainBranchName,
  setOpen,
  setSearchQuery,
  visibleCommits,
  onSelectBaseline,
}: {
  commitsQuery: ReturnType<typeof useQuery<ProjectCommitEntry[]>>
  onSelectBaseline: (baseline: ProjectDiffBaseline) => void
  panelId: string
  panelPosition: BaselineSelectorPanelPosition
  panelRef: RefObject<HTMLDivElement | null>
  positionReady: boolean
  searchQuery: string
  selectedBaseline: ProjectDiffBaseline
  selectedCommitSha: string | null
  parentBranchName?: string | null | undefined
  defaultBranchName?: string | null | undefined
  devBranchName?: string | null | undefined
  mainBranchName?: string | null | undefined
  setOpen: (open: boolean) => void
  setSearchQuery: (query: string) => void
  visibleCommits: ProjectCommitEntry[]
}) {
  if (typeof document === 'undefined') return null
  const panelLeft = `${panelPosition.left}px`
  const panelWidth = `${panelPosition.width}px`
  const commits = commitsQuery.data ?? []
  const headCommit = commits.find((commit) => commit.isHead) ?? commits[0]
  const previousCommit = commits.find((commit) => !commit.isHead && commit.sha !== headCommit?.sha)
  return createPortal(
    <PopoverPanel
      open={positionReady}
      id={panelId}
      ref={panelRef}
      data-open={positionReady ? 'true' : 'false'}
      aria-label="Diff baseline selector"
      className={cn(
        popoverPanelClass,
        composerPopoverBottomRowLayerClass,
        'motion-popover fixed grid max-h-[calc(100vh-1rem)] grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-1.5 rounded-xl border-0 p-1.5 transition-[opacity,transform] duration-150 ease-out',
        positionReady ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0',
      )}
      style={{
        bottom: `${panelPosition.bottom}px`,
        left: panelLeft,
        maxHeight: `${panelPosition.maxHeight}px`,
        width: panelWidth,
      }}
    >
      <div className={composerPopoverSectionLabelClass}>Changes since</div>
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
          <div className={cn('px-2.5 py-3', appTypeSmallClass, appToneMutedClass)}>
            {commitsQuery.isLoading ? 'Loading commits…' : 'No commits found.'}
          </div>
        )}
      </div>
      <label className="relative block">
        <Search
          size={13}
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[color:var(--muted)]"
        />
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search commits"
          className={cn(composerPopoverInputClass, 'w-full pl-8')}
        />
      </label>
      {baselineOptions.map((option) => (
        <BaselineOption
          key={option.key}
          label={option.label}
          meta={option.key === 'head' ? getCommitMeta(headCommit) : getCommitMeta(previousCommit)}
          selected={selectedBaseline.kind === option.key}
          onSelect={() => {
            onSelectBaseline(option.baseline)
            setOpen(false)
          }}
        />
      ))}
      <BranchBaselineOptions
        defaultBranchName={defaultBranchName}
        devBranchName={devBranchName}
        mainBranchName={mainBranchName}
        parentBranchName={parentBranchName}
        selectedBaseline={selectedBaseline}
        setOpen={setOpen}
        onSelectBaseline={onSelectBaseline}
      />
    </PopoverPanel>,
    document.body,
  )
}
