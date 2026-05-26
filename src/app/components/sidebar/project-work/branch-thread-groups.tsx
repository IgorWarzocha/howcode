import { GitBranch, GitFork } from 'lucide-react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project, View } from '../../../types'
import { BranchInlineActions, BranchSessionCount } from './branch-row-actions'
import type { BranchThreadGroup, WorktreeBranchGroup } from './project-work-model'
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
  const hasWorktrees = group.worktrees.length > 0
  const canToggleGroup = canToggleThreads || hasWorktrees

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
    worktreePath: worktree.path,
    worktreeBranchName: worktree.branchName ?? group.label,
  }

  return (
    <section className="sidebar-project-work-worktree-group" data-last={isLast ? 'true' : 'false'}>
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
          data-action-count="2"
          data-confirming={confirmingPrune ? 'true' : 'false'}
        >
          <BranchInlineActions
            canPrune={true}
            canSwitch={false}
            confirmingPrune={confirmingPrune}
            currentBranch={currentBranch}
            group={worktreeGroup}
            project={project}
            switchBlocked={false}
            onAction={onAction}
            onCancelPrune={() => onSetPruneConfirmBranchId(null)}
            onConfirmPrune={() => onSetPruneConfirmBranchId(null)}
            onRequestPruneConfirm={() => onSetPruneConfirmBranchId(worktreeActionKey)}
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
