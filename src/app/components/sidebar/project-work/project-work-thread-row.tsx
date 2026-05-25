import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project, Thread, View } from '../../../types'
import { ThreadRow } from '../thread-row/thread-row'

export function ProjectWorkThreadRow({
  activeView,
  project,
  selectedThreadId,
  terminalRunningSessionPaths,
  thread,
  currentBranch,
  onAction,
  onThreadOpen,
}: {
  activeView: View
  project: Project
  selectedThreadId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  thread: Thread
  currentBranch: string | null
  onAction: DesktopActionInvoker
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
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
        thread.sessionPath && terminalRunningSessionPaths.has(thread.sessionPath),
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
        if (!thread.sessionPath) return
        onThreadOpen(project.id, thread.id, thread.sessionPath)
      }}
      onPin={() =>
        onAction('thread.pin', {
          projectId: project.id,
          threadId: thread.id,
        })
      }
    />
  )
}
