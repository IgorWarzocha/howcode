import { ArchiveRestore, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CompactMetaRow } from '../common/compact-meta-row'
import { ConfirmPopover } from '../common/confirm-popover'
import { Tooltip } from '../common/tooltip'
import { ViewHeader } from '../common/view-header'
import { ViewShell } from '../common/view-shell'
import type { ArchivedChat, DesktopActionInvoker } from '../desktop/types'
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

type ArchivedChatsViewProps = {
  chats: ArchivedChat[]
  onAction: DesktopActionInvoker
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function getRestoredChatIdsAfterFailedArchiveMutation(
  result: Awaited<ReturnType<ArchivedChatsViewProps['onAction']>> | null,
  chatIds: string[],
) {
  const deletedChatIds = getStringArray(result?.result?.deletedChatIds)
  const failedChatIds = getStringArray(result?.result?.failedChatIds)
  if (failedChatIds.length > 0) return failedChatIds
  if (deletedChatIds.length === 0) return chatIds
  const deletedChatIdSet = new Set(deletedChatIds)
  return chatIds.filter((chatId) => !deletedChatIdSet.has(chatId))
}

export function ArchivedChatsView({ chats, onAction }: ArchivedChatsViewProps) {
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([])
  const [optimisticallyHiddenChatIds, setOptimisticallyHiddenChatIds] = useState<string[]>([])
  const [busyAction, setBusyAction] = useState<'restore' | 'delete' | null>(null)
  const [confirmBulkDeleteTarget, setConfirmBulkDeleteTarget] = useState<'all' | 'selected' | null>(
    null,
  )
  const deleteAllButtonRef = useRef<HTMLButtonElement>(null)
  const deleteSelectedButtonRef = useRef<HTMLButtonElement>(null)

  const optimisticallyHiddenChatIdSet = useMemo(
    () => new Set(optimisticallyHiddenChatIds),
    [optimisticallyHiddenChatIds],
  )
  const selectedChatIdSet = useMemo(() => new Set(selectedChatIds), [selectedChatIds])
  const visibleChats = useMemo(
    () => chats.filter((chat) => !optimisticallyHiddenChatIdSet.has(chat.id)),
    [optimisticallyHiddenChatIdSet, chats],
  )
  const visibleChatIds = useMemo(() => visibleChats.map((chat) => chat.id), [visibleChats])
  const visibleDirectoryIds = useMemo(() => {
    const directoryIds = new Set<string>()
    for (const chat of visibleChats) {
      directoryIds.add(chat.directoryId)
    }
    return [...directoryIds]
  }, [visibleChats])
  const selectedVisibleDirectoryIds = useMemo(() => {
    const directoryIds = new Set<string>()
    for (const chat of visibleChats) {
      if (selectedChatIdSet.has(chat.id)) {
        directoryIds.add(chat.directoryId)
      }
    }
    return [...directoryIds]
  }, [selectedChatIdSet, visibleChats])

  useEffect(() => {
    const chatIds = new Set(chats.map((chat) => chat.id))

    setOptimisticallyHiddenChatIds((current) => current.filter((chatId) => chatIds.has(chatId)))
  }, [chats])

  useEffect(() => {
    const nextVisibleChatIds = new Set(visibleChatIds)

    setSelectedChatIds((current) => current.filter((chatId) => nextVisibleChatIds.has(chatId)))
  }, [visibleChatIds])

  const allVisibleSelected =
    visibleChatIds.length > 0 && selectedChatIds.length === visibleChatIds.length
  const selectedCountLabel =
    selectedChatIds.length > 0 ? `${selectedChatIds.length} selected` : 'Select archived chats'

  const runArchivedChatMutation = async ({
    action,
    busyState,
    chatIds,
    directoryId,
    directoryIds,
  }: {
    action: 'chat.restore' | 'chat.restore-many' | 'chat.delete' | 'chat.delete-many'
    busyState: 'restore' | 'delete'
    chatIds: string[]
    directoryId?: string
    directoryIds?: string[]
  }) => {
    if (chatIds.length === 0 || busyAction) {
      return
    }

    const previousSelectedChatIds = selectedChatIds
    setConfirmBulkDeleteTarget(null)
    setBusyAction(busyState)
    setOptimisticallyHiddenChatIds((current) => [...new Set([...current, ...chatIds])])
    const mutationChatIdSet = new Set(chatIds)
    setSelectedChatIds((current) => current.filter((chatId) => !mutationChatIdSet.has(chatId)))

    try {
      const result = await onAction(
        action,
        action === 'chat.restore' || action === 'chat.delete'
          ? { directoryId, chatId: chatIds[0] }
          : { directoryIds, chatIds },
      )
      const failed =
        result === null || result.ok === false || typeof result.result?.error === 'string'

      if (failed) {
        const restoredChatIds = getRestoredChatIdsAfterFailedArchiveMutation(result, chatIds)
        const restoredChatIdSet = new Set(restoredChatIds)

        setOptimisticallyHiddenChatIds((current) =>
          current.filter((chatId) => !restoredChatIdSet.has(chatId)),
        )
        setSelectedChatIds(previousSelectedChatIds)
      }
    } catch {
      setOptimisticallyHiddenChatIds((current) =>
        current.filter((chatId) => !mutationChatIdSet.has(chatId)),
      )
      setSelectedChatIds(previousSelectedChatIds)
    }

    setBusyAction(null)
  }

  return (
    <ViewShell className={skillsViewShellClass}>
      <ViewHeader
        title="Archived chats"
        actions={
          visibleChats.length > 0 ? (
            <div className="relative">
              <Tooltip content="Delete all archived chats" placement="left">
                <button
                  ref={deleteAllButtonRef}
                  type="button"
                  className={`inline-flex h-7 items-center gap-1 rounded-md px-1.5 ${appTypeSmallClass} ${appToneMutedClass} transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--danger)] disabled:cursor-not-allowed disabled:opacity-45`}
                  disabled={busyAction !== null}
                  aria-label="Delete all archived chats"
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
                  void runArchivedChatMutation({
                    action: 'chat.delete-many',
                    busyState: 'delete',
                    directoryIds: visibleDirectoryIds,
                    chatIds: visibleChatIds,
                  })
                }}
              />
            </div>
          ) : null
        }
      />

      {visibleChats.length > 0 ? (
        <div className={skillsListClass}>
          <CompactMetaRow
            density="dense"
            contentClassName={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 overflow-hidden ${appTypeGroupTextClass}`}
            actions={
              <div className="flex items-center gap-0.5">
                <Tooltip content="Restore selected archived chats">
                  <button
                    type="button"
                    className={viewCloseButtonClass}
                    disabled={selectedChatIds.length === 0 || busyAction !== null}
                    aria-label="Restore selected archived chats"
                    onClick={() => {
                      void runArchivedChatMutation({
                        action: 'chat.restore-many',
                        busyState: 'restore',
                        directoryIds: selectedVisibleDirectoryIds,
                        chatIds: selectedChatIds,
                      })
                    }}
                  >
                    <ArchiveRestore size={13} />
                  </button>
                </Tooltip>
                <div className="relative">
                  <Tooltip content="Delete selected archived chats">
                    <button
                      ref={deleteSelectedButtonRef}
                      type="button"
                      className={cn(viewCloseButtonClass, 'hover:text-[color:var(--danger)]')}
                      disabled={selectedChatIds.length === 0 || busyAction !== null}
                      aria-label="Delete selected archived chats"
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
                      void runArchivedChatMutation({
                        action: 'chat.delete-many',
                        busyState: 'delete',
                        directoryIds: selectedVisibleDirectoryIds,
                        chatIds: selectedChatIds,
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
                  onChange={() => setSelectedChatIds(allVisibleSelected ? [] : visibleChatIds)}
                  disabled={busyAction !== null}
                  aria-label="Select all archived chats"
                />
              </span>
              <span className={appTypeGroupTextClass}>{selectedCountLabel}</span>
            </label>
          </CompactMetaRow>

          {visibleChats.map((chat) => (
            <CompactMetaRow
              key={chat.id}
              density="dense"
              selected={selectedChatIdSet.has(chat.id)}
              contentClassName={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 overflow-hidden ${appTypeGroupTextClass}`}
              actions={
                <div className="flex items-center gap-0.5">
                  <Tooltip content="Restore chat">
                    <button
                      type="button"
                      className={viewCloseButtonClass}
                      disabled={busyAction !== null}
                      aria-label={`Restore ${chat.title}`}
                      onClick={() => {
                        void runArchivedChatMutation({
                          action: 'chat.restore',
                          busyState: 'restore',
                          chatIds: [chat.id],
                          directoryId: chat.directoryId,
                        })
                      }}
                    >
                      <ArchiveRestore size={13} />
                    </button>
                  </Tooltip>
                  <Tooltip content="Delete chat">
                    <button
                      type="button"
                      className={cn(viewCloseButtonClass, 'hover:text-[color:var(--danger)]')}
                      disabled={busyAction !== null}
                      aria-label={`Delete ${chat.title}`}
                      onClick={() => {
                        void runArchivedChatMutation({
                          action: 'chat.delete',
                          busyState: 'delete',
                          chatIds: [chat.id],
                          directoryId: chat.directoryId,
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
                  checked={selectedChatIdSet.has(chat.id)}
                  onChange={() =>
                    setSelectedChatIds((current) =>
                      new Set(current).has(chat.id)
                        ? current.filter((chatId) => chatId !== chat.id)
                        : [...current, chat.id],
                    )
                  }
                  disabled={busyAction !== null}
                  aria-label={`Select ${chat.title}`}
                />
              </span>

              <div className="flex min-w-0 items-baseline gap-1.5">
                <span className={`truncate ${appTypeGroupTextClass} ${appToneTextClass}`}>
                  {chat.title}
                </span>
                <span
                  aria-hidden="true"
                  className={`${appTypeGroupTextClass} ${appToneMutedClass}`}
                >
                  •
                </span>
                <span className={`truncate ${appTypeGroupTextClass} ${appToneMutedClass}`}>
                  {chat.directoryName}
                </span>
                <span
                  aria-hidden="true"
                  className={`${appTypeGroupTextClass} ${appToneMutedClass}`}
                >
                  •
                </span>
                <span className={`shrink-0 ${appTypeGroupTextClass} ${appToneMutedClass}`}>
                  {chat.age}
                </span>
              </div>
            </CompactMetaRow>
          ))}
        </div>
      ) : (
        <div className={inlineEmptyNoteClass}>
          <div className="grid gap-1">
            <div className={`${appTypeSectionTitleClass} ${appToneTextClass}`}>
              No archived chats
            </div>
            <p className="m-0 max-w-[448px]">
              Archive a chat from the sidebar and it will show up here for restore or permanent
              deletion.
            </p>
          </div>
        </div>
      )}
    </ViewShell>
  )
}
