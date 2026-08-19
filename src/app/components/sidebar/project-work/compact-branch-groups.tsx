import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project, Thread, View } from '../../../types'
import type { BranchThreadGroup, WorktreeBranchGroup } from './branch-group-model'
import { BranchThreadGroupSection } from './branch-thread-group-section'

export function ProjectCompactBranchGroups({
  activeView,
  branchThreads,
  currentBranch,
  currentBranchDirty,
  currentBranchExpanded,
  hideSessionCounts,
  project,
  selectedThreadId,
  terminalRunningSessionPaths,
  unassignedExpanded,
  unassignedThreads,
  worktrees,
  onAction,
  onToggleCurrentBranch,
  onThreadOpen,
  onToggleUnassigned,
}: {
  activeView: View
  branchThreads: Thread[]
  currentBranch: string | null
  currentBranchDirty: boolean
  currentBranchExpanded: boolean
  hideSessionCounts: boolean
  project: Project
  selectedThreadId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  unassignedExpanded: boolean
  unassignedThreads: Thread[]
  worktrees: WorktreeBranchGroup[]
  onAction: DesktopActionInvoker
  onToggleCurrentBranch: () => void
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
  onToggleUnassigned: () => void
}) {
  const currentBranchGroup: BranchThreadGroup = {
    id: 'current-branch',
    label: currentBranch ?? 'No branch',
    threads: branchThreads,
    worktrees,
    kind: 'branch',
    current: true,
  }
  const unassignedGroup: BranchThreadGroup = {
    id: 'compact-unassigned',
    label: 'Unassigned',
    threads: unassignedThreads,
    worktrees: [],
    kind: 'unassigned',
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
        showBottomDivider={unassignedThreads.length > 0}
        onThreadOpen={onThreadOpen}
        onToggle={onToggleCurrentBranch}
      />

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
          showTopDivider
          onThreadOpen={onThreadOpen}
          onToggle={onToggleUnassigned}
        />
      ) : null}
    </>
  )
}
