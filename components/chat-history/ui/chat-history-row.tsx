import { ConfirmPopover } from '@howaboua/howcode-sdk/common/confirm-popover'
import { Tooltip } from '@howaboua/howcode-sdk/common/tooltip'
import { appToneTextClass } from '@howaboua/howcode-sdk/ui/typography-scale'
import { viewCloseButtonClass } from '@howcode/ui/classes'
import { GitBranch, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { DesktopActionInvoker } from '../../../src/app/desktop/types'
import { getChatAssignmentLabel, type PastChat } from './chat-history-model'

export function ChatHistoryRow({
  currentBranch,
  selected,
  chat,
  onAction,
  onDelete,
  onOpenChat,
  onToggleSelected,
}: {
  currentBranch: string | null
  selected: boolean
  chat: PastChat
  onAction: DesktopActionInvoker
  onDelete: () => void
  onOpenChat: (directoryId: string, chatId: string, conversationId: string) => void
  onToggleSelected: () => void
}) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const deleteButtonRef = useRef<HTMLButtonElement>(null)
  const canAssignToCurrentBranch = Boolean(currentBranch && !chat.branchName?.trim())
  const assignLabel = currentBranch ? `Assign to ${currentBranch}` : null

  return (
    <div className="grid min-h-9 min-w-0 grid-cols-[1rem_minmax(0,1fr)_auto_auto_auto_auto] items-center gap-2 rounded-md px-2 text-sm text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]">
      <input
        type="checkbox"
        className="h-3.5 w-3.5 accent-[color:var(--accent)]"
        checked={selected}
        onChange={onToggleSelected}
        aria-label={`Select ${chat.title}`}
      />
      <button
        type="button"
        className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-center text-left"
        onClick={() => {
          if (!chat.conversationId) return
          onOpenChat(chat.directoryId, chat.id, chat.conversationId)
        }}
      >
        <span className={`truncate ${appToneTextClass}`}>{chat.title}</span>
      </button>
      <span className="inline-flex min-w-0 max-w-44 items-center gap-1 truncate text-xs text-[color:var(--muted-2)]">
        <GitBranch size={12} className="shrink-0" />
        <span className="truncate">{getChatAssignmentLabel(chat)}</span>
      </span>
      {canAssignToCurrentBranch && assignLabel ? (
        <Tooltip content={assignLabel}>
          <button
            type="button"
            className={viewCloseButtonClass}
            aria-label={`${assignLabel} for ${chat.title}`}
            onClick={() => {
              void onAction('chat.assign-branch', {
                directoryId: chat.directoryId,
                chatId: chat.id,
                branchName: currentBranch,
              })
            }}
          >
            <GitBranch size={13} />
          </button>
        </Tooltip>
      ) : null}
      <span className="shrink-0 text-xs text-[color:var(--muted-2)]">{chat.age}</span>
      <div className="relative">
        <Tooltip content="Delete chat">
          <button
            ref={deleteButtonRef}
            type="button"
            className={viewCloseButtonClass}
            aria-label={`Delete ${chat.title}`}
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
