import type { DragEvent } from 'react'
import type { ChatThread, DesktopActionInvoker } from '../../../desktop/types'
import { ThreadRow } from '../project-tree/thread-row'

export const chatThreadDragType = 'application/howcode-chat-thread'

type ChatThreadDropItemProps = {
  thread: ChatThread
  groupId: string | null
  selectedThreadId: string | null
  onAction: DesktopActionInvoker
  onRefresh: () => Promise<unknown>
  onThreadDrop: (event: DragEvent, groupId: string | null) => void
  onThreadOpen: (
    projectId: string,
    threadId: string,
    sessionPath: string,
    view?: 'chat' | 'thread' | undefined,
  ) => void
}

export function ChatThreadDropItem({
  thread,
  groupId,
  selectedThreadId,
  onAction,
  onRefresh,
  onThreadDrop,
  onThreadOpen,
}: ChatThreadDropItemProps) {
  return (
    <li
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(chatThreadDragType, thread.id)
        event.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => onThreadDrop(event, groupId)}
    >
      <ThreadRow
        age={thread.age}
        pinned={Boolean(thread.pinned)}
        running={Boolean(thread.running)}
        terminalRunning={false}
        unread={Boolean(thread.unread)}
        isSelected={selectedThreadId === thread.id}
        title={thread.title}
        onArchive={() => void onAction('thread.archive', { threadId: thread.id }).then(onRefresh)}
        onOpen={() =>
          thread.sessionPath &&
          onThreadOpen(thread.projectId, thread.id, thread.sessionPath, 'chat')
        }
        onPin={() => void onAction('thread.pin', { threadId: thread.id }).then(onRefresh)}
      />
    </li>
  )
}
