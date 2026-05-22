import { ArchiveRestore, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CompactMetaRow } from '../components/common/compact-meta-row'
import { ConfirmPopover } from '../components/common/confirm-popover'
import { Tooltip } from '../components/common/tooltip'
import { ViewHeader } from '../components/common/view-header'
import { ViewShell } from '../components/common/view-shell'
import type { ArchivedThread, DesktopActionInvoker } from '../desktop/types'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeGroupTextClass,
  appTypeSectionTitleClass,
  appTypeSmallClass,
  inlineEmptyNoteClass,
  viewCloseButtonClass,
} from '../ui/classes'
import {
  skillsActionColumnClass,
  skillsListClass,
  skillsViewShellClass,
} from '../ui/screen-classes'
import { cn } from '../utils/cn'

type ArchivedThreadsViewProps = {
  threads: ArchivedThread[]
  onAction: DesktopActionInvoker
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function getRestoredThreadIdsAfterFailedArchiveMutation(
  result: Awaited<ReturnType<ArchivedThreadsViewProps['onAction']>> | null,
  threadIds: string[],
) {
  const deletedThreadIds = getStringArray(result?.result?.deletedThreadIds)
  const failedThreadIds = getStringArray(result?.result?.failedThreadIds)
  if (failedThreadIds.length > 0) return failedThreadIds
  if (deletedThreadIds.length === 0) return threadIds
  const deletedThreadIdSet = new Set(deletedThreadIds)
  return threadIds.filter((threadId) => !deletedThreadIdSet.has(threadId))
}

export function ArchivedThreadsView({ threads, onAction }: ArchivedThreadsViewProps) {
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([])
  const [optimisticallyHiddenThreadIds, setOptimisticallyHiddenThreadIds] = useState<string[]>([])
  const [busyAction, setBusyAction] = useState<'restore' | 'delete' | null>(null)
  const [confirmBulkDeleteTarget, setConfirmBulkDeleteTarget] = useState<'all' | 'selected' | null>(
    null,
  )
  const deleteAllButtonRef = useRef<HTMLButtonElement>(null)
  const deleteSelectedButtonRef = useRef<HTMLButtonElement>(null)

  const optimisticallyHiddenThreadIdSet = useMemo(
    () => new Set(optimisticallyHiddenThreadIds),
    [optimisticallyHiddenThreadIds],
  )
  const selectedThreadIdSet = useMemo(() => new Set(selectedThreadIds), [selectedThreadIds])
  const visibleThreads = useMemo(
    () => threads.filter((thread) => !optimisticallyHiddenThreadIdSet.has(thread.id)),
    [optimisticallyHiddenThreadIdSet, threads],
  )
  const visibleThreadIds = useMemo(
    () => visibleThreads.map((thread) => thread.id),
    [visibleThreads],
  )
  const visibleProjectIds = useMemo(() => {
    const projectIds = new Set<string>()
    for (const thread of visibleThreads) {
      projectIds.add(thread.projectId)
    }
    return [...projectIds]
  }, [visibleThreads])
  const selectedVisibleProjectIds = useMemo(() => {
    const projectIds = new Set<string>()
    for (const thread of visibleThreads) {
      if (selectedThreadIdSet.has(thread.id)) {
        projectIds.add(thread.projectId)
      }
    }
    return [...projectIds]
  }, [selectedThreadIdSet, visibleThreads])

  useEffect(() => {
    const threadIds = new Set(threads.map((thread) => thread.id))

    setOptimisticallyHiddenThreadIds((current) =>
      current.filter((threadId) => threadIds.has(threadId)),
    )
  }, [threads])

  useEffect(() => {
    const nextVisibleThreadIds = new Set(visibleThreadIds)

    setSelectedThreadIds((current) =>
      current.filter((threadId) => nextVisibleThreadIds.has(threadId)),
    )
  }, [visibleThreadIds])

  useEffect(() => {
    if (busyAction !== null) {
      setConfirmBulkDeleteTarget(null)
    }
  }, [busyAction])

  const allVisibleSelected =
    visibleThreadIds.length > 0 && selectedThreadIds.length === visibleThreadIds.length
  const selectedCountLabel =
    selectedThreadIds.length > 0
      ? `${selectedThreadIds.length} selected`
      : 'Select archived threads'

  const runArchivedThreadMutation = async ({
    action,
    busyState,
    threadIds,
    projectId,
    projectIds,
  }: {
    action: 'thread.restore' | 'thread.restore-many' | 'thread.delete' | 'thread.delete-many'
    busyState: 'restore' | 'delete'
    threadIds: string[]
    projectId?: string
    projectIds?: string[]
  }) => {
    if (threadIds.length === 0 || busyAction) {
      return
    }

    setBusyAction(busyState)
    setOptimisticallyHiddenThreadIds((current) => [...new Set([...current, ...threadIds])])
    const mutationThreadIdSet = new Set(threadIds)
    setSelectedThreadIds((current) =>
      current.filter((threadId) => !mutationThreadIdSet.has(threadId)),
    )

    try {
      const result = await onAction(
        action,
        action === 'thread.restore' || action === 'thread.delete'
          ? { projectId, threadId: threadIds[0] }
          : { projectIds, threadIds },
      )
      const failed =
        result === null || result.ok === false || typeof result.result?.error === 'string'

      if (failed) {
        const restoredThreadIds = getRestoredThreadIdsAfterFailedArchiveMutation(result, threadIds)
        const restoredThreadIdSet = new Set(restoredThreadIds)

        setOptimisticallyHiddenThreadIds((current) =>
          current.filter((threadId) => !restoredThreadIdSet.has(threadId)),
        )
      }
    } catch {
      setOptimisticallyHiddenThreadIds((current) =>
        current.filter((threadId) => !mutationThreadIdSet.has(threadId)),
      )
    }

    setBusyAction(null)
  }

  return (
    <ViewShell className={skillsViewShellClass}>
      <ViewHeader
        title="Archived threads"
        actions={
          visibleThreads.length > 0 ? (
            <div className="relative">
              <Tooltip content="Delete all archived threads" placement="left">
                <button
                  ref={deleteAllButtonRef}
                  type="button"
                  className={`inline-flex h-7 items-center gap-1 rounded-md px-1.5 ${appTypeSmallClass} ${appToneMutedClass} transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--danger)] disabled:cursor-not-allowed disabled:opacity-45`}
                  disabled={busyAction !== null}
                  aria-label="Delete all archived threads"
                  onClick={() => {
                    setConfirmBulkDeleteTarget((current) => (current === 'all' ? null : 'all'))
                  }}
                >
                  <Trash2 size={14} className="text-[color:var(--danger)]" />
                  Delete all
                </button>
              </Tooltip>

              <ConfirmPopover
                open={confirmBulkDeleteTarget === 'all'}
                anchorRef={deleteAllButtonRef}
                confirmLabel="Delete"
                onClose={() => setConfirmBulkDeleteTarget(null)}
                onConfirm={() => {
                  setConfirmBulkDeleteTarget(null)
                  void runArchivedThreadMutation({
                    action: 'thread.delete-many',
                    busyState: 'delete',
                    projectIds: visibleProjectIds,
                    threadIds: visibleThreadIds,
                  })
                }}
              />
            </div>
          ) : null
        }
      />

      {visibleThreads.length > 0 ? (
        <div className={skillsListClass}>
          <CompactMetaRow
            density="dense"
            contentClassName={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 overflow-hidden ${appTypeGroupTextClass}`}
            actions={
              <div className="flex items-center gap-0.5">
                <Tooltip content="Restore selected archived threads">
                  <button
                    type="button"
                    className={viewCloseButtonClass}
                    disabled={selectedThreadIds.length === 0 || busyAction !== null}
                    aria-label="Restore selected archived threads"
                    onClick={() => {
                      void runArchivedThreadMutation({
                        action: 'thread.restore-many',
                        busyState: 'restore',
                        projectIds: selectedVisibleProjectIds,
                        threadIds: selectedThreadIds,
                      })
                    }}
                  >
                    <ArchiveRestore size={13} />
                  </button>
                </Tooltip>
                <div className="relative">
                  <Tooltip content="Delete selected archived threads">
                    <button
                      ref={deleteSelectedButtonRef}
                      type="button"
                      className={cn(viewCloseButtonClass, 'hover:text-[color:var(--danger)]')}
                      disabled={selectedThreadIds.length === 0 || busyAction !== null}
                      aria-label="Delete selected archived threads"
                      onClick={() => {
                        setConfirmBulkDeleteTarget((current) =>
                          current === 'selected' ? null : 'selected',
                        )
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </Tooltip>

                  <ConfirmPopover
                    open={confirmBulkDeleteTarget === 'selected'}
                    anchorRef={deleteSelectedButtonRef}
                    confirmLabel="Delete"
                    onClose={() => setConfirmBulkDeleteTarget(null)}
                    onConfirm={() => {
                      setConfirmBulkDeleteTarget(null)
                      void runArchivedThreadMutation({
                        action: 'thread.delete-many',
                        busyState: 'delete',
                        projectIds: selectedVisibleProjectIds,
                        threadIds: selectedThreadIds,
                      })
                    }}
                  />
                </div>
              </div>
            }
          >
            <label className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 text-[color:var(--text)]">
              <span className={skillsActionColumnClass}>
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[color:var(--accent)]"
                  checked={allVisibleSelected}
                  onChange={() => setSelectedThreadIds(allVisibleSelected ? [] : visibleThreadIds)}
                  disabled={busyAction !== null}
                  aria-label="Select all archived threads"
                />
              </span>
              <span className={appTypeGroupTextClass}>{selectedCountLabel}</span>
            </label>
          </CompactMetaRow>

          {visibleThreads.map((thread) => (
            <CompactMetaRow
              key={thread.id}
              density="dense"
              selected={selectedThreadIdSet.has(thread.id)}
              contentClassName={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 overflow-hidden ${appTypeGroupTextClass}`}
              actions={
                <div className="flex items-center gap-0.5">
                  <Tooltip content="Restore thread">
                    <button
                      type="button"
                      className={viewCloseButtonClass}
                      disabled={busyAction !== null}
                      aria-label={`Restore ${thread.title}`}
                      onClick={() => {
                        void runArchivedThreadMutation({
                          action: 'thread.restore',
                          busyState: 'restore',
                          threadIds: [thread.id],
                          projectId: thread.projectId,
                        })
                      }}
                    >
                      <ArchiveRestore size={13} />
                    </button>
                  </Tooltip>
                  <Tooltip content="Delete thread">
                    <button
                      type="button"
                      className={cn(viewCloseButtonClass, 'hover:text-[color:var(--danger)]')}
                      disabled={busyAction !== null}
                      aria-label={`Delete ${thread.title}`}
                      onClick={() => {
                        void runArchivedThreadMutation({
                          action: 'thread.delete',
                          busyState: 'delete',
                          threadIds: [thread.id],
                          projectId: thread.projectId,
                        })
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </Tooltip>
                </div>
              }
            >
              <span className={skillsActionColumnClass}>
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[color:var(--accent)]"
                  checked={selectedThreadIdSet.has(thread.id)}
                  onChange={() =>
                    setSelectedThreadIds((current) =>
                      current.includes(thread.id)
                        ? current.filter((threadId) => threadId !== thread.id)
                        : [...current, thread.id],
                    )
                  }
                  disabled={busyAction !== null}
                  aria-label={`Select ${thread.title}`}
                />
              </span>

              <div className="flex min-w-0 items-baseline gap-1.5">
                <span className={`truncate ${appTypeGroupTextClass} ${appToneTextClass}`}>
                  {thread.title}
                </span>
                <span
                  aria-hidden="true"
                  className={`${appTypeGroupTextClass} ${appToneMutedClass}`}
                >
                  •
                </span>
                <span className={`truncate ${appTypeGroupTextClass} ${appToneMutedClass}`}>
                  {thread.projectName}
                </span>
                <span
                  aria-hidden="true"
                  className={`${appTypeGroupTextClass} ${appToneMutedClass}`}
                >
                  •
                </span>
                <span className={`shrink-0 ${appTypeGroupTextClass} ${appToneMutedClass}`}>
                  {thread.age}
                </span>
              </div>
            </CompactMetaRow>
          ))}
        </div>
      ) : (
        <div className={inlineEmptyNoteClass}>
          <div className="grid gap-1">
            <div className={`${appTypeSectionTitleClass} ${appToneTextClass}`}>
              No archived threads
            </div>
            <p className="m-0 max-w-[448px]">
              Archive a thread from the sidebar and it will show up here for restore or permanent
              deletion.
            </p>
          </div>
        </div>
      )}
    </ViewShell>
  )
}
