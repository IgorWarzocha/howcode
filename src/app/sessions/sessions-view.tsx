import { useEffect, useMemo, useState } from 'react'
import { ViewHeader } from '../common/view-header'
import { ViewShell } from '../common/view-shell'
import type { DesktopActionInvoker } from '../desktop/types'
import type { Project } from '../types'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeSectionTitleClass,
  inlineEmptyNoteClass,
} from '../ui/classes'
import { skillsViewShellClass } from '../ui/screen-classes'
import { cn } from '../utils/cn'
import { SessionRow } from './session-row'
import {
  filterPastSessionThreads,
  getPastSessionThreads,
  getSelectedSessionProjectIds,
  type SessionBulkAction,
} from './sessions-model'
import { SessionsToolbar } from './sessions-toolbar'

type SessionsViewProps = {
  project: Project | null
  projects: Project[]
  currentBranch: string | null
  onAction: DesktopActionInvoker
  onClose: () => void
  onOpenThread: (projectId: string, threadId: string, sessionPath: string) => void
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
  const pastThreads = useMemo(() => getPastSessionThreads(project, projects), [project, projects])
  const visibleThreads = useMemo(
    () => filterPastSessionThreads(pastThreads, searchQuery),
    [pastThreads, searchQuery],
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
    const threadIdSet = new Set(threadIds)
    if (action === 'delete') {
      await onAction('thread.delete-many', {
        projectIds: getSelectedSessionProjectIds(pastThreads, threadIds),
        threadIds,
      })
    } else {
      await Promise.all(
        pastThreads.flatMap((thread) =>
          threadIdSet.has(thread.id)
            ? [
                onAction('thread.assign-branch', {
                  projectId: thread.projectId,
                  threadId: thread.id,
                  branchName: action === 'assign-current' ? currentBranch : null,
                }),
              ]
            : [],
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
                  if (event.key === 'Escape') setSearchQuery('')
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
                  selected={selectedThreadIdSet.has(thread.id)}
                  thread={thread}
                  onAction={onAction}
                  onDelete={() => void runBulkAction('delete', [thread.id])}
                  onOpenThread={onOpenThread}
                  onToggleSelected={() =>
                    setSelectedThreadIds((current) =>
                      new Set(current).has(thread.id)
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
