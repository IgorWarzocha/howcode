import type { DesktopActionInvoker } from '../../../../../src/app/desktop/types'
import type { View, WorkingDirectory } from '../../../../../src/app/types'
import { WorktreeSmallIcon } from '../../../../../src/app/ui/icons/worktree-small-icon'
import { getBranchActionCapabilities } from './branch-action-capabilities'
import type { BranchWorkspace, WorktreeBranchGroup } from './branch-group-model'
import { BranchInlineActions, BranchSessionCount } from './branch-row-actions'
import { DirectoryWorkChatRow } from './directory-work-chat-row'

export function WorktreeGroupSection({
  activeView,
  currentBranch,
  hideSessionCounts,
  isLast,
  directory,
  selectedChatId,
  terminalRunningConversationIds,
  worktree,
  onAction,
  onChatOpen,
}: {
  activeView: View
  currentBranch: string | null
  hideSessionCounts: boolean
  isLast: boolean
  directory: WorkingDirectory
  selectedChatId: string | null
  terminalRunningConversationIds: ReadonlySet<string>
  worktree: WorktreeBranchGroup
  onAction: DesktopActionInvoker
  onChatOpen: (directoryId: string, chatId: string, conversationId: string) => void
}) {
  const chatDirectory = { ...directory, id: worktree.path }
  const chatAssignBranch = worktree.branchName ?? null
  const worktreeHasBranch = Boolean(worktree.branchName)
  const worktreeGroup: BranchWorkspace = {
    id: worktree.id,
    label: worktree.label,
    chats: worktree.chats,
    worktrees: [],
    kind: 'worktree',
    worktreeComplete: Boolean(worktree.complete),
    worktreePath: worktree.path,
    worktreeBranchName: worktree.branchName ?? null,
  }
  const actionCapabilities = getBranchActionCapabilities(worktreeGroup, {
    canPrune: worktreeHasBranch,
    canMergeWorktree:
      worktreeHasBranch &&
      (!worktree.parentBranchName || worktree.parentBranchName === currentBranch),
  })

  return (
    <section
      className="sidebar-project-work-worktree-group"
      data-branch-group-kind="worktree"
      data-current={worktree.complete ? 'false' : 'true'}
      data-last={isLast ? 'true' : 'false'}
    >
      <div className="sidebar-compact-row sidebar-compact-row--branch sidebar-project-work-branch-heading sidebar-project-work-worktree-heading">
        <span className="sidebar-icon-action sidebar-icon-action--xs sidebar-icon-action--no-hover sidebar-project-work-branch-disclosure">
          <WorktreeSmallIcon size={13} className="sidebar-project-work-branch-icon" />
        </span>
        <span className="sidebar-project-work-branch-toggle">
          <span className="truncate">{worktree.label}</span>
        </span>
        <span className="sidebar-project-work-branch-meta">
          <BranchSessionCount count={worktree.chats.length} hidden={hideSessionCounts} />
        </span>
        <BranchInlineActions
          capabilities={actionCapabilities}
          currentBranch={currentBranch}
          group={worktreeGroup}
          directory={directory}
          switchBlocked={false}
          onAction={onAction}
        />
      </div>
      {worktree.chats.length > 0 ? (
        <div className="sidebar-project-work-branch-thread-list sidebar-project-work-worktree-thread-list">
          {worktree.chats.map((chat) => (
            <DirectoryWorkChatRow
              key={chat.id}
              activeView={activeView}
              directory={chatDirectory}
              selectedChatId={selectedChatId}
              terminalRunningConversationIds={terminalRunningConversationIds}
              chat={chat}
              onAction={onAction}
              onChatOpen={onChatOpen}
              currentBranch={chatAssignBranch}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
