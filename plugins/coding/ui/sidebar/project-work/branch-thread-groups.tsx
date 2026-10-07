import type { DesktopActionInvoker } from '../../../../../src/app/desktop/types'
import type { Project, View } from '../../../../../src/app/types'
import {
  shouldShowBranchGroupDividerAfter,
  shouldShowBranchGroupDividerBefore,
} from './branch-group-layout'
import type { BranchThreadGroup } from './branch-group-model'
import { BranchThreadGroupSection } from './branch-thread-group-section'

export function ProjectExpandedBranchGroups({
  activeView,
  branchGroups,
  collapsedBranchIds,
  currentBranch,
  currentBranchDirty = false,
  hideSessionCounts,
  normalizedSearchQuery,
  project,
  selectedThreadId,
  terminalRunningConversationIds,
  onAction,
  onSetCollapsedBranchIds,
  onThreadOpen,
}: {
  activeView: View
  branchGroups: BranchThreadGroup[]
  collapsedBranchIds: Record<string, boolean>
  currentBranch: string | null
  currentBranchDirty?: boolean
  hideSessionCounts: boolean
  normalizedSearchQuery: string
  project: Project
  selectedThreadId: string | null
  terminalRunningConversationIds: ReadonlySet<string>
  onAction: DesktopActionInvoker
  onSetCollapsedBranchIds: (
    updater: (current: Record<string, boolean>) => Record<string, boolean>,
  ) => void
  onThreadOpen: (projectId: string, threadId: string, conversationId: string) => void
}) {
  return (
    <div className="sidebar-project-work-project-expanded-branches">
      {branchGroups.map((group, index) => {
        const groupKey = `${project.id}:${group.id}`
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
          <BranchThreadGroupSection
            key={group.id}
            activeView={activeView}
            collapsed={collapsed}
            currentBranch={currentBranch}
            currentBranchDirty={currentBranchDirty}
            group={group}
            hideSessionCounts={hideSessionCounts}
            project={project}
            selectedThreadId={selectedThreadId}
            terminalRunningConversationIds={terminalRunningConversationIds}
            onAction={onAction}
            showBottomDivider={showBottomDivider}
            showTopDivider={showTopDivider}
            onThreadOpen={onThreadOpen}
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
