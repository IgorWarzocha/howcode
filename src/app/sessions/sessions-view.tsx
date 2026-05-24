import { GitBranch, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Tooltip } from '../common/tooltip'
import { ViewHeader } from '../common/view-header'
import { ViewShell } from '../common/view-shell'
import type { DesktopActionInvoker } from '../desktop/types'
import type { Project, Thread } from '../types'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeSectionTitleClass,
  inlineEmptyNoteClass,
  viewCloseButtonClass,
} from '../ui/classes'
import { skillsViewShellClass } from '../ui/screen-classes'
import { cn } from '../utils/cn'

const OLD_THREAD_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000

type SessionsViewProps = {
  project: Project | null
  currentBranch: string | null
  onAction: DesktopActionInvoker
  onClose: () => void
  onOpenThread: (projectId: string, threadId: string, sessionPath: string) => void
}

type SessionBulkAction = 'delete' | 'assign-current' | 'unassign'

function getThreadSortValue(thread: Thread) {
  return thread.lastModifiedMs ?? 0
}

function getOldProjectThreads(project: Project | null) {
  if (!project) return []
  const cutoffMs = Date.now() - OLD_THREAD_THRESHOLD_MS
  return [...project.threads]
    .filter((thread) => {
      if (thread.pinned || thread.running || thread.unread) return false
      return (thread.lastModifiedMs ?? Number.MAX_SAFE_INTEGER) < cutoffMs
    })
    .sort((a, b) => getThreadSortValue(b) - getThreadSortValue(a))
}

function threadMatchesSearch(thread: Thread, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true
  return [thread.title, thread.summary ?? '', thread.branchName ?? '']
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery)
}

function SessionsToolbar({
  allVisibleSelected,
  currentBranch,
  selectedCount,
  visibleThreadIds,
  onRunBulkAction,
  onSetSelectedThreadIds,
}: {
  allVisibleSelected: boolean
  currentBranch: string | null
  selectedCount: number
  visibleThreadIds: string[]
  onRunBulkAction: (action: SessionBulkAction, threadIds?: string[]) => void
  onSetSelectedThreadIds: (threadIds: string[]) => void
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-[color:var(--muted)]">
      <label className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 pl-2">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-[color:var(--accent)]"
          checked={allVisibleSelected}
          onChange={() => onSetSelectedThreadIds(allVisibleSelected ? [] : visibleThreadIds)}
          aria-label="Select visible sessions"
        />
        <span>{selectedCount > 0 ? `${selectedCount} selected` : 'Select sessions'}</span>
      </label>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className="rounded px-1.5 py-1 hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] disabled:opacity-45"
          disabled={selectedCount === 0 || !currentBranch}
          onClick={() => onRunBulkAction('assign-current')}
        >
          Assign current branch
        </button>
        <button
          type="button"
          className="rounded px-1.5 py-1 hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] disabled:opacity-45"
          disabled={selectedCount === 0}
          onClick={() => onRunBulkAction('unassign')}
        >
          Unassign
        </button>
        <button
          type="button"
          className="rounded px-1.5 py-1 text-[color:var(--danger)] hover:bg-[color:color-mix(in_srgb,var(--danger-bg)_48%,transparent)] disabled:opacity-45"
          disabled={selectedCount === 0}
          onClick={() => onRunBulkAction('delete')}
        >
          Delete selected
        </button>
        <button
          type="button"
          className="rounded px-1.5 py-1 text-[color:var(--danger)] hover:bg-[color:color-mix(in_srgb,var(--danger-bg)_48%,transparent)] disabled:opacity-45"
          disabled={visibleThreadIds.length === 0}
          onClick={() => onRunBulkAction('delete', visibleThreadIds)}
        >
          Delete all
        </button>
      </div>
    </div>
  )
}

function SessionRow({
  currentBranch,
  project,
  selected,
  thread,
  onAction,
  onDelete,
  onOpenThread,
  onToggleSelected,
}: {
  currentBranch: string | null
  project: Project | null
  selected: boolean
  thread: Thread
  onAction: DesktopActionInvoker
  onDelete: () => void
  onOpenThread: (projectId: string, threadId: string, sessionPath: string) => void
  onToggleSelected: () => void
}) {
  const assignedToCurrent = currentBranch && thread.branchName === currentBranch
  const assignLabel = assignedToCurrent
    ? `Unassign from ${currentBranch}`
    : currentBranch
      ? `Assign to ${currentBranch}`
      : 'Clear assigned branch'

  return (
    <div className="grid min-h-9 min-w-0 grid-cols-[1rem_minmax(0,1fr)_auto_auto_auto_auto] items-center gap-2 rounded-md px-2 text-sm text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]">
      <input
        type="checkbox"
        className="h-3.5 w-3.5 accent-[color:var(--accent)]"
        checked={selected}
        onChange={onToggleSelected}
        aria-label={`Select ${thread.title}`}
      />
      <button
        type="button"
        className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-center text-left"
        onClick={() => {
          if (!(project && thread.sessionPath)) return
          onOpenThread(project.id, thread.id, thread.sessionPath)
        }}
      >
        <span className={`truncate ${appToneTextClass}`}>{thread.title}</span>
      </button>
      <span className="inline-flex min-w-0 max-w-44 items-center gap-1 truncate text-xs text-[color:var(--muted-2)]">
        <GitBranch size={12} className="shrink-0" />
        <span className="truncate">{thread.branchName ?? 'Unassigned'}</span>
      </span>
      <Tooltip content={assignLabel}>
        <button
          type="button"
          className={viewCloseButtonClass}
          aria-label={`${assignLabel} for ${thread.title}`}
          onClick={() => {
            void onAction('thread.assign-branch', {
              projectId: project?.id,
              threadId: thread.id,
              branchName: assignedToCurrent ? null : currentBranch,
            })
          }}
        >
          <GitBranch size={13} />
        </button>
      </Tooltip>
      <span className="shrink-0 text-xs text-[color:var(--muted-2)]">{thread.age}</span>
      <Tooltip content="Delete session">
        <button
          type="button"
          className={viewCloseButtonClass}
          aria-label={`Delete ${thread.title}`}
          onClick={onDelete}
        >
          <Trash2 size={13} />
        </button>
      </Tooltip>
    </div>
  )
}

export function SessionsView({
  currentBranch,
  project,
  onAction,
  onClose,
  onOpenThread,
}: SessionsViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([])
  const oldThreads = useMemo(() => getOldProjectThreads(project), [project])
  const visibleThreads = useMemo(
    () => oldThreads.filter((thread) => threadMatchesSearch(thread, searchQuery)),
    [oldThreads, searchQuery],
  )
  const visibleThreadIds = useMemo(
    () => visibleThreads.map((thread) => thread.id),
    [visibleThreads],
  )
  const selectedThreadIdSet = useMemo(() => new Set(selectedThreadIds), [selectedThreadIds])
  const allVisibleSelected =
    visibleThreadIds.length > 0 &&
    visibleThreadIds.every((threadId) => selectedThreadIdSet.has(threadId))

  useEffect(() => {
    const visibleThreadIdSet = new Set(visibleThreadIds)
    setSelectedThreadIds((current) =>
      current.filter((threadId) => visibleThreadIdSet.has(threadId)),
    )
  }, [visibleThreadIds])

  const runBulkAction = async (action: SessionBulkAction, threadIds = selectedThreadIds) => {
    if (!project || threadIds.length === 0) return
    if (action === 'delete') {
      await onAction('thread.delete-many', { projectIds: [project.id], threadIds })
    } else {
      await Promise.all(
        threadIds.map((threadId) =>
          onAction('thread.assign-branch', {
            projectId: project.id,
            threadId,
            branchName: action === 'assign-current' ? currentBranch : null,
          }),
        ),
      )
    }
    setSelectedThreadIds([])
  }

  return (
    <ViewShell className={`${skillsViewShellClass} h-full min-h-0 content-stretch overflow-hidden`}>
      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden">
        <div className="grid gap-4">
          <ViewHeader
            title="Past sessions"
            onClose={onClose}
            closeLabel="Close past sessions"
            closeTooltip={false}
          />

          <div className="grid gap-3">
            <div className="grid gap-1">
              <div className={`${appTypeSectionTitleClass} ${appToneTextClass}`}>
                {project?.name ?? 'No project selected'}
              </div>
            </div>

            <label className="grid min-h-9 grid-cols-[minmax(0,1fr)] items-center rounded-md bg-[color:var(--surface-hover)] px-3">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Escape') return
                  setSearchQuery('')
                }}
                placeholder="Search past sessions"
                className="min-w-0 bg-transparent text-sm text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]"
                aria-label="Search sessions"
              />
            </label>
            {visibleThreads.length > 0 ? (
              <SessionsToolbar
                allVisibleSelected={allVisibleSelected}
                currentBranch={currentBranch}
                selectedCount={selectedThreadIds.length}
                visibleThreadIds={visibleThreadIds}
                onRunBulkAction={(action, threadIds) => void runBulkAction(action, threadIds)}
                onSetSelectedThreadIds={setSelectedThreadIds}
              />
            ) : null}
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto overflow-x-hidden pr-3 [scrollbar-gutter:stable]">
          {visibleThreads.length > 0 ? (
            <div className="grid gap-1">
              {visibleThreads.map((thread) => (
                <SessionRow
                  key={thread.id}
                  currentBranch={currentBranch}
                  project={project}
                  selected={selectedThreadIdSet.has(thread.id)}
                  thread={thread}
                  onAction={onAction}
                  onDelete={() => void runBulkAction('delete', [thread.id])}
                  onOpenThread={onOpenThread}
                  onToggleSelected={() =>
                    setSelectedThreadIds((current) =>
                      current.includes(thread.id)
                        ? current.filter((threadId) => threadId !== thread.id)
                        : [...current, thread.id],
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <div className={inlineEmptyNoteClass}>
              <div className="grid gap-1">
                <div className={`${appTypeSectionTitleClass} ${appToneTextClass}`}>
                  No past sessions
                </div>
                <p className={cn('m-0 max-w-[448px]', appToneMutedClass)}>
                  Older project threads will appear here once they leave the active sidebar.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </ViewShell>
  )
}
