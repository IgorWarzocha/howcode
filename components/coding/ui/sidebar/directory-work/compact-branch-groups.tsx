import type { DesktopActionInvoker } from '../../../../../src/app/desktop/types'
import type { Chat, View, WorkingDirectory } from '../../../../../src/app/types'
import { BranchWorkspaceSection } from './branch-chat-group-section'
import type { BranchWorkspace, WorktreeBranchGroup } from './branch-group-model'

export function DirectoryCompactBranchGroups({
  activeView,
  branchChats,
  currentBranch,
  currentBranchDirty,
  currentBranchExpanded,
  hideSessionCounts,
  directory,
  selectedChatId,
  terminalRunningConversationIds,
  unassignedExpanded,
  unassignedChats,
  worktrees,
  onAction,
  onToggleCurrentBranch,
  onChatOpen,
  onToggleUnassigned,
}: {
  activeView: View
  branchChats: Chat[]
  currentBranch: string | null
  currentBranchDirty: boolean
  currentBranchExpanded: boolean
  hideSessionCounts: boolean
  directory: WorkingDirectory
  selectedChatId: string | null
  terminalRunningConversationIds: ReadonlySet<string>
  unassignedExpanded: boolean
  unassignedChats: Chat[]
  worktrees: WorktreeBranchGroup[]
  onAction: DesktopActionInvoker
  onToggleCurrentBranch: () => void
  onChatOpen: (directoryId: string, chatId: string, conversationId: string) => void
  onToggleUnassigned: () => void
}) {
  const currentBranchGroup: BranchWorkspace = {
    id: 'current-branch',
    label: currentBranch ?? 'No branch',
    chats: branchChats,
    worktrees,
    kind: 'branch',
    current: true,
  }
  const unassignedGroup: BranchWorkspace = {
    id: 'compact-unassigned',
    label: 'Unassigned',
    chats: unassignedChats,
    worktrees: [],
    kind: 'unassigned',
  }
  return (
    <>
      <BranchWorkspaceSection
        actionCapabilityOverrides={{
          canCreateWorktree: Boolean(currentBranch),
          canPrune: Boolean(currentBranch),
        }}
        activeView={activeView}
        collapsed={!currentBranchExpanded}
        currentBranch={currentBranch}
        currentBranchDirty={currentBranchDirty}
        group={currentBranchGroup}
        hideSessionCounts={hideSessionCounts}
        directory={directory}
        selectedChatId={selectedChatId}
        terminalRunningConversationIds={terminalRunningConversationIds}
        onAction={onAction}
        showBottomDivider={unassignedChats.length > 0}
        onChatOpen={onChatOpen}
        onToggle={onToggleCurrentBranch}
      />

      {unassignedChats.length > 0 ? (
        <BranchWorkspaceSection
          activeView={activeView}
          collapsed={!unassignedExpanded}
          currentBranch={currentBranch}
          group={unassignedGroup}
          hideSessionCounts={hideSessionCounts}
          directory={directory}
          selectedChatId={selectedChatId}
          terminalRunningConversationIds={terminalRunningConversationIds}
          onAction={onAction}
          showTopDivider
          onChatOpen={onChatOpen}
          onToggle={onToggleUnassigned}
        />
      ) : null}
    </>
  )
}
