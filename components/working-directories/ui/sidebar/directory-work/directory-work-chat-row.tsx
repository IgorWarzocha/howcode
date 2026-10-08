import { ChatRow } from '../../../../../src/app/components/sidebar/chat-row/chat-row'
import type { DesktopActionInvoker } from '../../../../../src/app/desktop/types'
import type { Chat, View, WorkingDirectory } from '../../../../../src/app/types'

export function DirectoryWorkChatRow({
  activeView,
  directory,
  selectedChatId,
  terminalRunningConversationIds,
  chat,
  currentBranch,
  onAction,
  onChatOpen,
}: {
  activeView: View
  directory: WorkingDirectory
  selectedChatId: string | null
  terminalRunningConversationIds: ReadonlySet<string>
  chat: Chat
  currentBranch: string | null
  onAction: DesktopActionInvoker
  onChatOpen: (directoryId: string, chatId: string, conversationId: string) => void
}) {
  const isSelected =
    selectedChatId === chat.id &&
    (activeView === 'chat' || activeView === 'directory' || activeView === 'gitops')
  const canAssignToCurrentBranch = Boolean(currentBranch && !chat.branchName?.trim())

  return (
    <ChatRow
      age={chat.age}
      pinned={Boolean(chat.pinned)}
      running={Boolean(chat.running)}
      terminalRunning={Boolean(
        chat.conversationId && terminalRunningConversationIds.has(chat.conversationId),
      )}
      unread={Boolean(chat.unread)}
      isSelected={isSelected}
      title={chat.title}
      assignBranchLabel={canAssignToCurrentBranch ? `Assign to ${currentBranch}` : undefined}
      onDelete={() =>
        onAction('chat.delete', {
          directoryId: directory.id,
          chatId: chat.id,
        })
      }
      confirmDelete
      onAssignToBranch={
        canAssignToCurrentBranch
          ? () =>
              onAction('chat.assign-branch', {
                directoryId: directory.id,
                chatId: chat.id,
                branchName: currentBranch,
              })
          : undefined
      }
      onOpen={() => {
        if (!chat.conversationId) return
        onChatOpen(directory.id, chat.id, chat.conversationId)
      }}
      onPin={() =>
        onAction('chat.pin', {
          directoryId: directory.id,
          chatId: chat.id,
        })
      }
      onRename={(title) =>
        onAction('chat.rename', {
          directoryId: directory.id,
          conversationId: chat.conversationId,
          chatId: chat.id,
          value: title,
        })
      }
    />
  )
}
