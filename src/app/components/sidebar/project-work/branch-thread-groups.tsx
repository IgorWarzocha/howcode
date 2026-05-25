import { GitBranch, GitFork } from 'lucide-react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project, View } from '../../../types'
import { BranchInlineActions, BranchSessionCount } from './branch-row-actions'
import type { BranchThreadGroup } from './project-work-model'
import { ProjectWorkThreadRow } from './project-work-thread-row'

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
  const canPruneBranch = !group.unassigned
  const canSwitchBranch = !(group.current || group.unassigned || group.worktree)
  const actionCount = canPruneBranch && canSwitchBranch ? 3 : canPruneBranch ? 2 : 1
  const branchActionKey = `${project.id}:${group.id}`
  const confirmingPrune = pruneConfirmBranchId === branchActionKey
  const switchBlocked = switchErrorBranchId === branchActionKey
  const threadProject = group.worktreePath ? { ...project, id: group.worktreePath } : project
  const canToggleThreads = group.threads.length > 0

  return (
    <section
      className="sidebar-project-work-branch-group"
      data-current={group.current || group.worktree ? 'true' : 'false'}
    >
      <div className="sidebar-compact-row sidebar-compact-row--branch sidebar-project-work-branch-heading">
        <button
          type="button"
          className="sidebar-icon-action sidebar-icon-action--xs sidebar-icon-action--no-hover sidebar-project-work-branch-disclosure"
          onClick={onToggle}
          disabled={!canToggleThreads}
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
          disabled={!canToggleThreads}
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
          data-action-count={actionCount}
          data-confirming={confirmingPrune ? 'true' : 'false'}
        >
          <BranchInlineActions
            canPrune={canPruneBranch}
            canSwitch={canSwitchBranch}
            confirmingPrune={confirmingPrune}
            currentBranch={currentBranch}
            group={group}
            project={project}
            switchBlocked={switchBlocked}
            onAction={onAction}
            onCancelPrune={() => onSetPruneConfirmBranchId(null)}
            onConfirmPrune={() => onSetPruneConfirmBranchId(null)}
            onRequestPruneConfirm={() => onSetPruneConfirmBranchId(branchActionKey)}
            onSwitchBlocked={() => onSetSwitchErrorBranchId(branchActionKey)}
            onSwitchFailed={() => onSetSwitchErrorBranchId(null)}
          />
        </span>
      </div>

      {collapsed ? null : (
        <div className="sidebar-project-work-branch-thread-list">
          {group.threads.length > 0
            ? group.threads.map((thread) => (
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
              ))
            : null}
        </div>
      )}
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
