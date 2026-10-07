import { ThreadRow } from '../../../../../src/app/components/sidebar/thread-row/thread-row'
import type { DesktopActionInvoker } from '../../../../../src/app/desktop/types'
import type { Project, Thread, View } from '../../../../../src/app/types'

export function ProjectWorkThreadRow({
  activeView,
  project,
  selectedThreadId,
  terminalRunningConversationIds,
  thread,
  currentBranch,
  onAction,
  onThreadOpen,
}: {
  activeView: View
  project: Project
  selectedThreadId: string | null
  terminalRunningConversationIds: ReadonlySet<string>
  thread: Thread
  currentBranch: string | null
  onAction: DesktopActionInvoker
  onThreadOpen: (projectId: string, threadId: string, conversationId: string) => void
}) {
  const isSelected =
    selectedThreadId === thread.id &&
    (activeView === 'thread' || activeView === 'project' || activeView === 'gitops')
  const canAssignToCurrentBranch = Boolean(currentBranch && !thread.branchName?.trim())

  return (
    <ThreadRow
      age={thread.age}
      pinned={Boolean(thread.pinned)}
      running={Boolean(thread.running)}
      terminalRunning={Boolean(
        thread.conversationId && terminalRunningConversationIds.has(thread.conversationId),
      )}
      unread={Boolean(thread.unread)}
      isSelected={isSelected}
      title={thread.title}
      assignBranchLabel={canAssignToCurrentBranch ? `Assign to ${currentBranch}` : undefined}
      onDelete={() =>
        onAction('thread.delete', {
          projectId: project.id,
          threadId: thread.id,
        })
      }
      confirmDelete
      onAssignToBranch={
        canAssignToCurrentBranch
          ? () =>
              onAction('thread.assign-branch', {
                projectId: project.id,
                threadId: thread.id,
                branchName: currentBranch,
              })
          : undefined
      }
      onOpen={() => {
        if (!thread.conversationId) return
        onThreadOpen(project.id, thread.id, thread.conversationId)
      }}
      onPin={() =>
        onAction('thread.pin', {
          projectId: project.id,
          threadId: thread.id,
        })
      }
      onRename={(title) =>
        onAction('thread.rename', {
          projectId: project.id,
          conversationId: thread.conversationId,
          threadId: thread.id,
          value: title,
        })
      }
    />
  )
}
