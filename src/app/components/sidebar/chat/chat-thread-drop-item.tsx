import type { DragEvent } from 'react'
import type { ChatThread, DesktopActionInvoker } from '../../../desktop/types'
import { ThreadRow } from '../thread-row/thread-row'

export const chatThreadDragType = 'application/howcode-chat-thread'

type ChatThreadDropItemProps = {
  thread: ChatThread
  groupId: string | null
  selectedThreadId: string | null
  onAction: DesktopActionInvoker
  onThreadDrop: (event: DragEvent, groupId: string | null) => void
  onThreadOpen: (
    projectId: string,
    threadId: string,
    conversationId: string,
    view?: 'chat' | 'thread' | undefined,
  ) => void
}

export function ChatThreadDropItem({
  thread,
  groupId,
  selectedThreadId,
  onAction,
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
        onDelete={() => void onAction('thread.archive', { threadId: thread.id })}
        onOpen={() =>
          thread.conversationId &&
          onThreadOpen(
            thread.projectId,
            thread.id,
            thread.conversationId,
            thread.isChat === false ? 'thread' : 'chat',
          )
        }
        onPin={() => void onAction('thread.pin', { threadId: thread.id })}
        onRename={(title) =>
          void onAction('thread.rename', {
            projectId: thread.projectId,
            conversationId: thread.conversationId,
            threadId: thread.id,
            value: title,
          })
        }
      />
    </li>
  )
}
