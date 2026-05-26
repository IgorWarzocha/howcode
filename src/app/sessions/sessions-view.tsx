import { GitBranch, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ConfirmPopover } from '../common/confirm-popover'
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
  projects: Project[]
  currentBranch: string | null
  onAction: DesktopActionInvoker
  onClose: () => void
  onOpenThread: (projectId: string, threadId: string, sessionPath: string) => void
}

type PastSessionThread = Thread & {
  projectId: string
  worktreeLabel?: string | undefined
}

type SessionBulkAction = 'delete' | 'assign-current' | 'unassign'

function getThreadSortValue(thread: Thread) {
  return thread.lastModifiedMs ?? 0
}

function getWorktreeProjectsForSessions(project: Project | null, projects: readonly Project[]) {
  if (!project) return []
  return projects.filter(
    (candidate) =>
      candidate.worktree?.isMain === false && candidate.worktree.rootProjectId === project.id,
  )
}

function getOldProjectThreads(project: Project | null, projects: readonly Project[]) {
  if (!project) return []
  const cutoffMs = Date.now() - OLD_THREAD_THRESHOLD_MS
  const threads: PastSessionThread[] = [
    ...project.threads.map((thread) => ({ ...thread, projectId: project.id })),
    ...getWorktreeProjectsForSessions(project, projects).flatMap((worktreeProject) =>
      worktreeProject.threads.map((thread) => ({
        ...thread,
        projectId: worktreeProject.id,
        worktreeLabel: worktreeProject.worktree?.branchName ?? worktreeProject.name,
        branchName: thread.branchName ?? worktreeProject.worktree?.branchName ?? undefined,
      })),
    ),
  ]
  return threads
    .filter((thread) => {
      if (thread.pinned || thread.running || thread.unread) return false
      return (thread.lastModifiedMs ?? Number.MAX_SAFE_INTEGER) < cutoffMs
    })
    .sort((a, b) => getThreadSortValue(b) - getThreadSortValue(a))
}

function threadMatchesSearch(thread: PastSessionThread, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true
  return [thread.title, thread.summary ?? '', thread.branchName ?? '', thread.worktreeLabel ?? '']
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery)
}

function getSessionAssignmentLabel(thread: PastSessionThread) {
  const branchLabel = thread.branchName ?? 'Unassigned'
  if (!thread.worktreeLabel) return branchLabel
  return thread.worktreeLabel === branchLabel
    ? `${branchLabel} worktree`
    : `${thread.worktreeLabel} · ${branchLabel}`
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
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<'selected' | 'all' | null>(null)
  const deleteSelectedButtonRef = useRef<HTMLButtonElement>(null)
  const deleteAllButtonRef = useRef<HTMLButtonElement>(null)

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
        <div className="relative">
          <button
            ref={deleteSelectedButtonRef}
            type="button"
            className="rounded px-1.5 py-1 text-[color:var(--danger)] hover:bg-[color:color-mix(in_srgb,var(--danger-bg)_48%,transparent)] disabled:opacity-45"
            disabled={selectedCount === 0}
            onClick={() =>
              setConfirmDeleteTarget((current) => (current === 'selected' ? null : 'selected'))
            }
          >
            Delete selected
          </button>
          <ConfirmPopover
            open={confirmDeleteTarget === 'selected'}
            anchorRef={deleteSelectedButtonRef}
            confirmLabel="Delete"
            onClose={() => setConfirmDeleteTarget(null)}
            onConfirm={() => {
              setConfirmDeleteTarget(null)
              onRunBulkAction('delete')
            }}
          />
        </div>
        <div className="relative">
          <button
            ref={deleteAllButtonRef}
            type="button"
            className="rounded px-1.5 py-1 text-[color:var(--danger)] hover:bg-[color:color-mix(in_srgb,var(--danger-bg)_48%,transparent)] disabled:opacity-45"
            disabled={visibleThreadIds.length === 0}
            onClick={() => setConfirmDeleteTarget((current) => (current === 'all' ? null : 'all'))}
          >
            Delete all
          </button>
          <ConfirmPopover
            open={confirmDeleteTarget === 'all'}
            anchorRef={deleteAllButtonRef}
            confirmLabel="Delete"
            onClose={() => setConfirmDeleteTarget(null)}
            onConfirm={() => {
              setConfirmDeleteTarget(null)
              onRunBulkAction('delete', visibleThreadIds)
            }}
          />
        </div>
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
  thread: PastSessionThread
  onAction: DesktopActionInvoker
  onDelete: () => void
  onOpenThread: (projectId: string, threadId: string, sessionPath: string) => void
  onToggleSelected: () => void
}) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const deleteButtonRef = useRef<HTMLButtonElement>(null)
  const canAssignToCurrentBranch = Boolean(currentBranch && !thread.branchName?.trim())
  const assignLabel = currentBranch ? `Assign to ${currentBranch}` : null

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
          onOpenThread(thread.projectId, thread.id, thread.sessionPath)
        }}
      >
        <span className={`truncate ${appToneTextClass}`}>{thread.title}</span>
      </button>
      <span className="inline-flex min-w-0 max-w-44 items-center gap-1 truncate text-xs text-[color:var(--muted-2)]">
        <GitBranch size={12} className="shrink-0" />
        <span className="truncate">{getSessionAssignmentLabel(thread)}</span>
      </span>
      {canAssignToCurrentBranch && assignLabel ? (
        <Tooltip content={assignLabel}>
          <button
            type="button"
            className={viewCloseButtonClass}
            aria-label={`${assignLabel} for ${thread.title}`}
            onClick={() => {
              void onAction('thread.assign-branch', {
                projectId: thread.projectId,
                threadId: thread.id,
                branchName: currentBranch,
              })
            }}
          >
            <GitBranch size={13} />
          </button>
        </Tooltip>
      ) : null}
      <span className="shrink-0 text-xs text-[color:var(--muted-2)]">{thread.age}</span>
      <div className="relative">
        <Tooltip content="Delete session">
          <button
            ref={deleteButtonRef}
            type="button"
            className={viewCloseButtonClass}
            aria-label={`Delete ${thread.title}`}
            onClick={() => setConfirmDeleteOpen((current) => !current)}
          >
            <Trash2 size={13} />
          </button>
        </Tooltip>
        <ConfirmPopover
          open={confirmDeleteOpen}
          anchorRef={deleteButtonRef}
          confirmLabel="Delete"
          onClose={() => setConfirmDeleteOpen(false)}
          onConfirm={() => {
            setConfirmDeleteOpen(false)
            onDelete()
          }}
        />
      </div>
    </div>
  )
}

export function SessionsView({
  currentBranch,
  project,
  projects,
  onAction,
  onClose,
  onOpenThread,
}: SessionsViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([])
  const oldThreads = useMemo(() => getOldProjectThreads(project, projects), [project, projects])
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
      const projectIds = [
        ...new Set(
          oldThreads
            .filter((thread) => threadIds.includes(thread.id))
            .map((thread) => thread.projectId),
        ),
      ]
      await onAction('thread.delete-many', { projectIds, threadIds })
    } else {
      await Promise.all(
        oldThreads
          .filter((thread) => threadIds.includes(thread.id))
          .map((thread) =>
            onAction('thread.assign-branch', {
              projectId: thread.projectId,
              threadId: thread.id,
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
