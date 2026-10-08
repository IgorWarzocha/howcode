import type { DesktopActionInvoker } from '../../../../../src/app/desktop/types'
import type { View, WorkingDirectory } from '../../../../../src/app/types'
import { BranchWorkspaceSection } from './branch-chat-group-section'
import {
  shouldShowBranchGroupDividerAfter,
  shouldShowBranchGroupDividerBefore,
} from './branch-group-layout'
import type { BranchWorkspace } from './branch-group-model'

export function DirectoryExpandedBranchGroups({
  activeView,
  branchGroups,
  collapsedBranchIds,
  currentBranch,
  currentBranchDirty = false,
  hideSessionCounts,
  normalizedSearchQuery,
  directory,
  selectedChatId,
  terminalRunningConversationIds,
  onAction,
  onSetCollapsedBranchIds,
  onChatOpen,
}: {
  activeView: View
  branchGroups: BranchWorkspace[]
  collapsedBranchIds: Record<string, boolean>
  currentBranch: string | null
  currentBranchDirty?: boolean
  hideSessionCounts: boolean
  normalizedSearchQuery: string
  directory: WorkingDirectory
  selectedChatId: string | null
  terminalRunningConversationIds: ReadonlySet<string>
  onAction: DesktopActionInvoker
  onSetCollapsedBranchIds: (
    updater: (current: Record<string, boolean>) => Record<string, boolean>,
  ) => void
  onChatOpen: (directoryId: string, chatId: string, conversationId: string) => void
}) {
  return (
    <div className="sidebar-project-work-project-expanded-branches">
      {branchGroups.map((group, index) => {
        const groupKey = `${directory.id}:${group.id}`
        const hasNextGroup = index < branchGroups.length - 1
        const defaultCollapsed = !(
          (group.kind === 'branch' && group.current) ||
          group.worktrees.length > 0
        )
        const collapsed = normalizedSearchQuery
          ? false
          : (collapsedBranchIds[groupKey] ?? defaultCollapsed)
        const showBottomDivider = shouldShowBranchGroupDividerAfter(group, hasNextGroup)
        const showTopDivider = shouldShowBranchGroupDividerBefore(group, index)
        return (
          <BranchWorkspaceSection
            key={group.id}
            activeView={activeView}
            collapsed={collapsed}
            currentBranch={currentBranch}
            currentBranchDirty={currentBranchDirty}
            group={group}
            hideSessionCounts={hideSessionCounts}
            directory={directory}
            selectedChatId={selectedChatId}
            terminalRunningConversationIds={terminalRunningConversationIds}
            onAction={onAction}
            showBottomDivider={showBottomDivider}
            showTopDivider={showTopDivider}
            onChatOpen={onChatOpen}
            onToggle={() =>
              onSetCollapsedBranchIds((current) => ({
                ...current,
                [groupKey]: !collapsed,
              }))
            }
          />
        )
      })}
    </div>
  )
}
