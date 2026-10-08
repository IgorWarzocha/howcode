import type { DragEvent } from 'react'
import type { DesktopActionInvoker, WorkspaceChat } from '../../../desktop/types'
import { ChatRow } from '../chat-row/chat-row'

export const workspaceChatDragType = 'application/howcode-chat-thread'

type WorkspaceChatItemProps = {
  chat: WorkspaceChat
  workspaceId: string | null
  selectedChatId: string | null
  onAction: DesktopActionInvoker
  onChatDrop: (event: DragEvent, workspaceId: string | null) => void
  onChatOpen: (
    directoryId: string,
    chatId: string,
    conversationId: string,
    composerProfile?: 'general' | 'coding' | undefined,
  ) => void
}

export function WorkspaceChatItem({
  chat,
  workspaceId,
  selectedChatId,
  onAction,
  onChatDrop,
  onChatOpen,
}: WorkspaceChatItemProps) {
  return (
    <li
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(workspaceChatDragType, chat.id)
        event.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => onChatDrop(event, workspaceId)}
    >
      <ChatRow
        age={chat.age}
        pinned={Boolean(chat.pinned)}
        running={Boolean(chat.running)}
        terminalRunning={false}
        unread={Boolean(chat.unread)}
        isSelected={selectedChatId === chat.id}
        title={chat.title}
        onDelete={() => void onAction('chat.archive', { chatId: chat.id })}
        onOpen={() =>
          chat.conversationId &&
          onChatOpen(chat.directoryId, chat.id, chat.conversationId, chat.composerProfile)
        }
        onPin={() => void onAction('chat.pin', { chatId: chat.id })}
        onRename={(title) =>
          void onAction('chat.rename', {
            directoryId: chat.directoryId,
            conversationId: chat.conversationId,
            chatId: chat.id,
            value: title,
          })
        }
      />
    </li>
  )
}
