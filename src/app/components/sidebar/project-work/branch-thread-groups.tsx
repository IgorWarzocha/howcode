import { GitBranch, GitFork } from 'lucide-react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project, View } from '../../../types'
import { BranchInlineActions, BranchSessionCount } from './branch-row-actions'
import type { BranchThreadGroup, WorktreeBranchGroup } from './project-work-model'
import { ProjectWorkThreadRow } from './project-work-thread-row'

function getBranchActionState(input: {
  group: BranchThreadGroup
  projectId: string
  pruneConfirmBranchId: string | null
}) {
  const { group, projectId, pruneConfirmBranchId } = input
  const canPruneBranch = !group.unassigned
  const canSwitchBranch = !(group.current || group.unassigned || group.worktree)
  const canToggleWorktreeComplete = group.worktree
  const canMergeWorktree = group.worktree
  const hasCompletedWorktrees =
    (group.completedWorktrees?.length ?? 0) > 0 ||
    group.worktrees.some((worktree) => worktree.complete)
  const canMergeCompletedWorktrees = !group.worktree && hasCompletedWorktrees
  const canRemoveCompletedWorktrees = !group.worktree && hasCompletedWorktrees
  const branchActionKey = `${projectId}:${group.id}`
  const completedWorktreesActionKey = `${branchActionKey}:completed-worktrees`
  return {
    actionCount:
      (canPruneBranch ? 1 : 0) +
      (canSwitchBranch ? 1 : 0) +
      (canToggleWorktreeComplete ? 1 : 0) +
      (canMergeWorktree ? 1 : 0) +
      (canMergeCompletedWorktrees ? 1 : 0) +
      (canRemoveCompletedWorktrees ? 1 : 0) +
      1,
    branchActionKey,
    completedWorktreesActionKey,
    canPruneBranch,
    canSwitchBranch,
    canToggleWorktreeComplete,
    canMergeWorktree,
    canMergeCompletedWorktrees,
    canRemoveCompletedWorktrees,
    confirmingPrune: pruneConfirmBranchId === branchActionKey,
    confirmingRemoveCompletedWorktrees: pruneConfirmBranchId === completedWorktreesActionKey,
  }
}

export function BranchThreadGroupSection({
  activeView,
  collapsed,
  currentBranch,
  group,
  hideSessionCounts,
  project,
  selectedThreadId,
  terminalRunningSessionPaths,
  onAction,
  onThreadOpen,
  onToggle,
  pruneConfirmBranchId,
  onSetPruneConfirmBranchId,
  switchErrorBranchId,
  onSetSwitchErrorBranchId,
}: {
  activeView: View
  collapsed: boolean
  currentBranch: string | null
  group: BranchThreadGroup
  hideSessionCounts: boolean
  project: Project
  selectedThreadId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  onAction: DesktopActionInvoker
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
  onToggle: () => void
  pruneConfirmBranchId: string | null
  onSetPruneConfirmBranchId: (branchId: string | null) => void
  switchErrorBranchId: string | null
  onSetSwitchErrorBranchId: (branchId: string | null) => void
}) {
  const actionState = getBranchActionState({
    group,
    projectId: project.id,
    pruneConfirmBranchId,
  })
  const switchBlocked = switchErrorBranchId === actionState.branchActionKey
  const threadProject = group.worktreePath ? { ...project, id: group.worktreePath } : project
  const canToggleThreads = group.threads.length > 0
  const hasWorktrees = group.worktrees.length > 0
  const canToggleGroup = canToggleThreads || hasWorktrees

  return (
    <section
      className="sidebar-project-work-branch-group"
      data-current={group.current || (group.worktree && !group.worktreeComplete) ? 'true' : 'false'}
    >
      <div className="sidebar-compact-row sidebar-compact-row--branch sidebar-project-work-branch-heading">
        <button
          type="button"
          className="sidebar-icon-action sidebar-icon-action--xs sidebar-icon-action--no-hover sidebar-project-work-branch-disclosure"
          onClick={onToggle}
          disabled={!canToggleGroup}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${group.label}` : `Collapse ${group.label}`}
        >
          {group.worktree ? (
            <GitFork size={13} className="sidebar-project-work-branch-icon" />
          ) : (
            <GitBranch size={13} className="sidebar-project-work-branch-icon" />
          )}
        </button>
        <button
          type="button"
          className="sidebar-project-work-branch-toggle"
          onClick={onToggle}
          disabled={!canToggleGroup}
          aria-expanded={!collapsed}
        >
          <span className="truncate">{group.label}</span>
        </button>
        <span className="sidebar-project-work-branch-meta">
          {group.current ? (
            <span className="sidebar-project-work-branch-current">Current</span>
          ) : null}
          <BranchSessionCount count={group.threads.length} hidden={hideSessionCounts} />
        </span>
        <span
          className="sidebar-project-work-branch-actions"
          data-action-count={actionState.actionCount}
          data-confirming={
            actionState.confirmingPrune || actionState.confirmingRemoveCompletedWorktrees
              ? 'true'
              : 'false'
          }
        >
          <BranchInlineActions
            canPrune={actionState.canPruneBranch}
            canSwitch={actionState.canSwitchBranch}
            canToggleWorktreeComplete={actionState.canToggleWorktreeComplete}
            canMergeWorktree={actionState.canMergeWorktree}
            canMergeCompletedWorktrees={actionState.canMergeCompletedWorktrees}
            canRemoveCompletedWorktrees={actionState.canRemoveCompletedWorktrees}
            confirmingPrune={actionState.confirmingPrune}
            confirmingRemoveCompletedWorktrees={actionState.confirmingRemoveCompletedWorktrees}
            currentBranch={currentBranch}
            group={group}
            project={project}
            switchBlocked={switchBlocked}
            onAction={onAction}
            onCancelPrune={() => onSetPruneConfirmBranchId(null)}
            onConfirmPrune={() => onSetPruneConfirmBranchId(null)}
            onRequestPruneConfirm={() => onSetPruneConfirmBranchId(actionState.branchActionKey)}
            onCancelRemoveCompletedWorktrees={() => onSetPruneConfirmBranchId(null)}
            onConfirmRemoveCompletedWorktrees={() => onSetPruneConfirmBranchId(null)}
            onRequestRemoveCompletedWorktreesConfirm={() =>
              onSetPruneConfirmBranchId(actionState.completedWorktreesActionKey)
            }
            onSwitchBlocked={() => onSetSwitchErrorBranchId(actionState.branchActionKey)}
            onSwitchFailed={() => onSetSwitchErrorBranchId(null)}
          />
        </span>
      </div>

      {collapsed ? null : (
        <div className="sidebar-project-work-branch-contents">
          {group.threads.length > 0 ? (
            <div className="sidebar-project-work-branch-thread-list">
              {group.threads.map((thread) => (
                <ProjectWorkThreadRow
                  key={thread.id}
                  activeView={activeView}
                  project={threadProject}
                  selectedThreadId={selectedThreadId}
                  terminalRunningSessionPaths={terminalRunningSessionPaths}
                  thread={thread}
                  onAction={onAction}
                  onThreadOpen={onThreadOpen}
                  currentBranch={currentBranch}
                />
              ))}
            </div>
          ) : null}
          {group.worktrees.map((worktree, index) => (
            <WorktreeGroupSection
              key={worktree.id}
              activeView={activeView}
              currentBranch={currentBranch}
              group={group}
              hideSessionCounts={hideSessionCounts}
              isLast={index === group.worktrees.length - 1}
              project={project}
              selectedThreadId={selectedThreadId}
              terminalRunningSessionPaths={terminalRunningSessionPaths}
              worktree={worktree}
              onAction={onAction}
              onThreadOpen={onThreadOpen}
              pruneConfirmBranchId={pruneConfirmBranchId}
              onSetPruneConfirmBranchId={onSetPruneConfirmBranchId}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function WorktreeGroupSection({
  activeView,
  currentBranch,
  group,
  hideSessionCounts,
  isLast,
  project,
  selectedThreadId,
  terminalRunningSessionPaths,
  worktree,
  onAction,
  onThreadOpen,
  pruneConfirmBranchId,
  onSetPruneConfirmBranchId,
}: {
  activeView: View
  currentBranch: string | null
  group: BranchThreadGroup
  hideSessionCounts: boolean
  isLast: boolean
  project: Project
  selectedThreadId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  worktree: WorktreeBranchGroup
  onAction: DesktopActionInvoker
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
  pruneConfirmBranchId: string | null
  onSetPruneConfirmBranchId: (branchId: string | null) => void
}) {
  const worktreeActionKey = `${project.id}:${worktree.id}`
  const confirmingPrune = pruneConfirmBranchId === worktreeActionKey
  const threadProject = { ...project, id: worktree.path }
  const worktreeGroup: BranchThreadGroup = {
    id: worktree.id,
    label: worktree.label,
    threads: worktree.threads,
    worktrees: [],
    current: false,
    unassigned: false,
    worktree: true,
    worktreeComplete: worktree.complete,
    worktreePath: worktree.path,
    worktreeBranchName: worktree.branchName ?? group.label,
  }

  return (
    <section
      className="sidebar-project-work-worktree-group"
      data-current={worktree.complete ? 'false' : 'true'}
      data-last={isLast ? 'true' : 'false'}
    >
      <div className="sidebar-compact-row sidebar-compact-row--branch sidebar-project-work-branch-heading sidebar-project-work-worktree-heading">
        <span className="sidebar-icon-action sidebar-icon-action--xs sidebar-icon-action--no-hover sidebar-project-work-branch-disclosure">
          <GitFork size={13} className="sidebar-project-work-branch-icon" />
        </span>
        <span className="sidebar-project-work-branch-toggle">
          <span className="truncate">{worktree.label}</span>
        </span>
        <span className="sidebar-project-work-branch-meta">
          <BranchSessionCount count={worktree.threads.length} hidden={hideSessionCounts} />
        </span>
        <span
          className="sidebar-project-work-branch-actions"
          data-action-count="4"
          data-confirming={confirmingPrune ? 'true' : 'false'}
        >
          <BranchInlineActions
            canPrune={true}
            canSwitch={false}
            canToggleWorktreeComplete={true}
            canMergeWorktree={true}
            canMergeCompletedWorktrees={false}
            canRemoveCompletedWorktrees={false}
            confirmingPrune={confirmingPrune}
            confirmingRemoveCompletedWorktrees={false}
            currentBranch={currentBranch}
            group={worktreeGroup}
            project={project}
            switchBlocked={false}
            onAction={onAction}
            onCancelPrune={() => onSetPruneConfirmBranchId(null)}
            onConfirmPrune={() => onSetPruneConfirmBranchId(null)}
            onRequestPruneConfirm={() => onSetPruneConfirmBranchId(worktreeActionKey)}
            onCancelRemoveCompletedWorktrees={() => undefined}
            onConfirmRemoveCompletedWorktrees={() => undefined}
            onRequestRemoveCompletedWorktreesConfirm={() => undefined}
            onSwitchBlocked={() => undefined}
            onSwitchFailed={() => undefined}
          />
        </span>
      </div>
      {worktree.threads.length > 0 ? (
        <div className="sidebar-project-work-branch-thread-list sidebar-project-work-worktree-thread-list">
          {worktree.threads.map((thread) => (
            <ProjectWorkThreadRow
              key={thread.id}
              activeView={activeView}
              project={threadProject}
              selectedThreadId={selectedThreadId}
              terminalRunningSessionPaths={terminalRunningSessionPaths}
              thread={thread}
              onAction={onAction}
              onThreadOpen={onThreadOpen}
              currentBranch={currentBranch}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}

export function ProjectExpandedBranchGroups({
  activeView,
  branchGroups,
  collapsedBranchIds,
  currentBranch,
  hideSessionCounts,
  normalizedSearchQuery,
  project,
  pruneConfirmBranchId,
  selectedThreadId,
  switchErrorBranchId,
  terminalRunningSessionPaths,
  onAction,
  onSetCollapsedBranchIds,
  onSetPruneConfirmBranchId,
  onSetSwitchErrorBranchId,
  onThreadOpen,
}: {
  activeView: View
  branchGroups: BranchThreadGroup[]
  collapsedBranchIds: Record<string, boolean>
  currentBranch: string | null
  hideSessionCounts: boolean
  normalizedSearchQuery: string
  project: Project
  pruneConfirmBranchId: string | null
  selectedThreadId: string | null
  switchErrorBranchId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  onAction: DesktopActionInvoker
  onSetCollapsedBranchIds: (
    updater: (current: Record<string, boolean>) => Record<string, boolean>,
  ) => void
  onSetPruneConfirmBranchId: (branchId: string | null) => void
  onSetSwitchErrorBranchId: (branchId: string | null) => void
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
}) {
  return (
    <div className="sidebar-project-work-project-expanded-branches">
      {branchGroups.map((group) => {
        const groupKey = `${project.id}:${group.id}`
        const defaultCollapsed = !group.current
        const collapsed = normalizedSearchQuery
          ? false
          : (collapsedBranchIds[groupKey] ?? defaultCollapsed)
        return (
          <BranchThreadGroupSection
            key={group.id}
            activeView={activeView}
            collapsed={collapsed}
            currentBranch={currentBranch}
            group={group}
            hideSessionCounts={hideSessionCounts}
            project={project}
            selectedThreadId={selectedThreadId}
            terminalRunningSessionPaths={terminalRunningSessionPaths}
            onAction={onAction}
            onThreadOpen={onThreadOpen}
            onToggle={() =>
              onSetCollapsedBranchIds((current) => ({
                ...current,
                [groupKey]: !collapsed,
              }))
            }
            pruneConfirmBranchId={pruneConfirmBranchId}
            onSetPruneConfirmBranchId={onSetPruneConfirmBranchId}
            switchErrorBranchId={switchErrorBranchId}
            onSetSwitchErrorBranchId={onSetSwitchErrorBranchId}
          />
        )
      })}
    </div>
  )
}
