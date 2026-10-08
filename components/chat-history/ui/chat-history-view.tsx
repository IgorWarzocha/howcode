import {
  appToneMutedClass,
  appToneTextClass,
  appTypeSectionTitleClass,
} from '@howaboua/howcode-sdk/ui/typography-scale'
import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { inlineEmptyNoteClass } from '@howcode/ui/classes'
import { useEffect, useMemo, useState } from 'react'
import { ViewHeader } from '../../../src/app/common/view-header'
import { ViewShell } from '../../../src/app/common/view-shell'
import type { DesktopActionInvoker } from '../../../src/app/desktop/types'
import type { WorkingDirectory } from '../../../src/app/types'
import { skillsViewShellClass } from '../../../src/app/ui/screen-classes'
import {
  type ChatHistoryBulkAction,
  filterPastChats,
  getPastChats,
  getSelectedChatDirectoryIds,
} from './chat-history-model'
import { ChatHistoryRow } from './chat-history-row'
import { ChatHistoryToolbar } from './chat-history-toolbar'

type DirectoryChatHistoryViewProps = {
  directory: WorkingDirectory | null
  directories: WorkingDirectory[]
  currentBranch: string | null
  onAction: DesktopActionInvoker
  onClose: () => void
  onOpenChat: (directoryId: string, chatId: string, conversationId: string) => void
}

export function DirectoryChatHistoryView({
  currentBranch,
  directory,
  directories,
  onAction,
  onClose,
  onOpenChat,
}: DirectoryChatHistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([])
  const pastChats = useMemo(() => getPastChats(directory, directories), [directory, directories])
  const visibleChats = useMemo(
    () => filterPastChats(pastChats, searchQuery),
    [pastChats, searchQuery],
  )
  const visibleChatIds = useMemo(() => visibleChats.map((chat) => chat.id), [visibleChats])
  const selectedChatIdSet = useMemo(() => new Set(selectedChatIds), [selectedChatIds])
  const allVisibleSelected =
    visibleChatIds.length > 0 && visibleChatIds.every((chatId) => selectedChatIdSet.has(chatId))

  useEffect(() => {
    const visibleChatIdSet = new Set(visibleChatIds)
    setSelectedChatIds((current) => current.filter((chatId) => visibleChatIdSet.has(chatId)))
  }, [visibleChatIds])

  const runBulkAction = async (action: ChatHistoryBulkAction, chatIds = selectedChatIds) => {
    if (!directory || chatIds.length === 0) return
    const chatIdSet = new Set(chatIds)
    if (action === 'delete') {
      await onAction('chat.delete-many', {
        directoryIds: getSelectedChatDirectoryIds(pastChats, chatIds),
        chatIds,
      })
    } else {
      await Promise.all(
        pastChats.flatMap((chat) =>
          chatIdSet.has(chat.id)
            ? [
                onAction('chat.assign-branch', {
                  directoryId: chat.directoryId,
                  chatId: chat.id,
                  branchName: action === 'assign-current' ? currentBranch : null,
                }),
              ]
            : [],
        ),
      )
    }
    setSelectedChatIds([])
  }

  return (
    <ViewShell className={`${skillsViewShellClass} h-full min-h-0 content-stretch overflow-hidden`}>
      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden">
        <div className="grid gap-4">
          <ViewHeader
            title="Past chats"
            onClose={onClose}
            closeLabel="Close past chats"
            closeTooltip={false}
          />

          <div className="grid gap-3">
            <div className="grid gap-1">
              <div className={`${appTypeSectionTitleClass} ${appToneTextClass}`}>
                {directory?.name ?? 'No workspace selected'}
              </div>
            </div>

            <label className="grid min-h-9 grid-cols-[minmax(0,1fr)] items-center rounded-md bg-[color:var(--surface-hover)] px-3">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setSearchQuery('')
                }}
                placeholder="Search past chats"
                className="min-w-0 bg-transparent text-sm text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]"
                aria-label="Search chats"
              />
            </label>
            {visibleChats.length > 0 ? (
              <ChatHistoryToolbar
                allVisibleSelected={allVisibleSelected}
                currentBranch={currentBranch}
                selectedCount={selectedChatIds.length}
                visibleChatIds={visibleChatIds}
                onRunBulkAction={(action, chatIds) => void runBulkAction(action, chatIds)}
                onSetSelectedChatIds={setSelectedChatIds}
              />
            ) : null}
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto overflow-x-hidden pr-3 [scrollbar-gutter:stable]">
          {visibleChats.length > 0 ? (
            <div className="grid gap-1">
              {visibleChats.map((chat) => (
                <ChatHistoryRow
                  key={chat.id}
                  currentBranch={currentBranch}
                  selected={selectedChatIdSet.has(chat.id)}
                  chat={chat}
                  onAction={onAction}
                  onDelete={() => void runBulkAction('delete', [chat.id])}
                  onOpenChat={onOpenChat}
                  onToggleSelected={() =>
                    setSelectedChatIds((current) =>
                      new Set(current).has(chat.id)
                        ? current.filter((chatId) => chatId !== chat.id)
                        : [...current, chat.id],
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <div className={inlineEmptyNoteClass}>
              <div className="grid gap-1">
                <div className={`${appTypeSectionTitleClass} ${appToneTextClass}`}>
                  No past chats
                </div>
                <p className={cn('m-0 max-w-[448px]', appToneMutedClass)}>
                  Older workspace chats will appear here once they leave the active sidebar.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </ViewShell>
  )
}
