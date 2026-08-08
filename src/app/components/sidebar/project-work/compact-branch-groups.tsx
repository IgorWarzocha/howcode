import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project, Thread, View } from '../../../types'
import {
  shouldShowBranchGroupDividerAfter,
  shouldShowBranchGroupDividerBefore,
} from './branch-group-layout'
import type { BranchThreadGroup, WorktreeBranch } from './branch-group-model'
import { BranchThreadGroupSection } from './branch-thread-group-section'

function getCompletedWorktreesForCompactCurrentBranch(
  worktreeGroups: readonly BranchThreadGroup[],
): WorktreeBranch[] {
  return worktreeGroups.flatMap((group) => {
    const nestedCompleted = [
      ...(group.completedWorktrees ?? []),
      ...group.worktrees.filter((worktree) => worktree.complete),
    ]
    if (!(group.worktree && group.worktreeComplete && group.worktreePath)) return nestedCompleted
    return [
      ...nestedCompleted,
      {
        label: group.label,
        path: group.worktreePath,
        branchName: group.worktreeBranchName ?? null,
        complete: true,
      },
    ]
  })
}

export function ProjectCompactBranchGroups({
  activeView,
  branchThreads,
  collapsedBranchIds,
  currentBranch,
  currentBranchDirty,
  currentBranchExpanded,
  hideSessionCounts,
  normalizedSearchQuery,
  project,
  selectedThreadId,
  terminalRunningSessionPaths,
  unassignedExpanded,
  unassignedThreads,
  worktreeGroups,
  onAction,
  onSetCollapsedBranchIds,
  onToggleCurrentBranch,
  onThreadOpen,
  onToggleUnassigned,
}: {
  activeView: View
  branchThreads: Thread[]
  collapsedBranchIds: Record<string, boolean>
  currentBranch: string | null
  currentBranchDirty: boolean
  currentBranchExpanded: boolean
  hideSessionCounts: boolean
  normalizedSearchQuery: string
  project: Project
  selectedThreadId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  unassignedExpanded: boolean
  unassignedThreads: Thread[]
  worktreeGroups: BranchThreadGroup[]
  onAction: DesktopActionInvoker
  onSetCollapsedBranchIds: (
    updater: (current: Record<string, boolean>) => Record<string, boolean>,
  ) => void
  onToggleCurrentBranch: () => void
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
  onToggleUnassigned: () => void
}) {
  const completedWorktrees = getCompletedWorktreesForCompactCurrentBranch(worktreeGroups)
  const currentBranchGroup: BranchThreadGroup = {
    id: 'current-branch',
    label: currentBranch ?? 'No branch',
    threads: branchThreads,
    worktrees: [],
    completedWorktrees,
    current: true,
    unassigned: false,
    worktree: false,
  }
  const unassignedGroup: BranchThreadGroup = {
    id: 'compact-unassigned',
    label: 'Unassigned',
    threads: unassignedThreads,
    worktrees: [],
    current: false,
    unassigned: true,
    worktree: false,
  }
  return (
    <>
      <BranchThreadGroupSection
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
        project={project}
        selectedThreadId={selectedThreadId}
        terminalRunningSessionPaths={terminalRunningSessionPaths}
        onAction={onAction}
        showBottomDivider={worktreeGroups.length > 0}
        onThreadOpen={onThreadOpen}
        onToggle={onToggleCurrentBranch}
      />

      {worktreeGroups.map((group, index) => {
        const groupKey = `${project.id}:${group.id}`
        const hasNextGroup = index < worktreeGroups.length - 1
        const collapsed = normalizedSearchQuery
          ? false
          : (collapsedBranchIds[groupKey] ??
            (group.threads.length === 0 && group.worktrees.length === 0))
        const showBottomDivider = shouldShowBranchGroupDividerAfter(group, hasNextGroup)
        const showTopDivider = shouldShowBranchGroupDividerBefore(group, index + 1)
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
            terminalRunningSessionPaths={terminalRunningSessionPaths}
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

      {unassignedThreads.length > 0 ? (
        <BranchThreadGroupSection
          activeView={activeView}
          collapsed={!unassignedExpanded}
          currentBranch={currentBranch}
          group={unassignedGroup}
          hideSessionCounts={hideSessionCounts}
          project={project}
          selectedThreadId={selectedThreadId}
          terminalRunningSessionPaths={terminalRunningSessionPaths}
          onAction={onAction}
          showTopDivider={worktreeGroups.length > 0}
          onThreadOpen={onThreadOpen}
          onToggle={onToggleUnassigned}
        />
      ) : null}
    </>
  )
}
