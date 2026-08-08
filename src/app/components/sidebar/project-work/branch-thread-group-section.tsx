import { ActivitySpinner } from '@howcode/common/activity-spinner'
import { Tooltip } from '@howcode/common/tooltip'
import { CircleOff, GitBranch, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project, View } from '../../../types'
import { WorktreeSmallIcon } from '../../../ui/icons/worktree-small-icon'
import { SidebarActionTooltip } from '../sidebar-action-tooltip'
import {
  type BranchActionCapabilities,
  getBranchActionCapabilities,
} from './branch-action-capabilities'
import type { BranchThreadGroup } from './branch-group-model'
import { BranchInlineActions, BranchSessionCount } from './branch-row-actions'
import { createThreadForBranch } from './new-thread-actions'
import { ProjectWorkThreadRow } from './project-work-thread-row'
import { getDesktopBranchActionFailure, useBranchActionExecution } from './useBranchActionExecution'
import { WorktreeGroupSection } from './worktree-group-section'

const dirtyBranchSwitchMessage = 'Worktree is dirty. Commit first.'

function BranchHeadingIcon({ group }: { group: BranchThreadGroup }) {
  if (group.unassigned) {
    return <CircleOff size={13} className="sidebar-project-work-unassigned-icon" />
  }
  if (group.worktree) {
    return <WorktreeSmallIcon size={13} className="sidebar-project-work-branch-icon" />
  }
  return <GitBranch size={13} className="sidebar-project-work-branch-icon" />
}

function BranchHeadingRow({ children, unassigned }: { children: ReactNode; unassigned: boolean }) {
  const row = (
    <div className="sidebar-compact-row sidebar-compact-row--branch sidebar-project-work-branch-heading">
      {children}
    </div>
  )
  if (!unassigned) return row
  return (
    <Tooltip
      content="Sessions not assigned to a git branch"
      className="sidebar-project-work-row-tooltip"
    >
      {row}
    </Tooltip>
  )
}

function getThreadAssignBranchForGroup(group: BranchThreadGroup, currentBranch: string | null) {
  if (!group.worktree) return currentBranch
  return group.worktreeBranchName ?? null
}

function getBranchGroupDividerState(input: {
  collapsed: boolean
  showBottomDivider: boolean
  showTopDivider: boolean
}) {
  if (input.collapsed) return { before: 'false', after: 'false' }
  return {
    before: input.showTopDivider ? 'true' : 'false',
    after: input.showBottomDivider ? 'true' : 'false',
  }
}

function getBranchGroupVisibilityState(group: BranchThreadGroup) {
  const canToggleThreads = group.threads.length > 0
  const hasWorktrees = group.worktrees.length > 0
  const emptySwitchableBranch = !(group.current || group.unassigned || group.worktree)
  const showEmptyBranchPrompt = !(canToggleThreads || hasWorktrees) && emptySwitchableBranch
  return {
    canToggleGroup: canToggleThreads || hasWorktrees || emptySwitchableBranch,
    showContents: canToggleThreads || hasWorktrees || showEmptyBranchPrompt,
    showEmptyBranchPrompt,
  }
}

function EmptyBranchPrompt({
  currentBranchDirty,
  group,
  project,
  onAction,
}: {
  currentBranchDirty: boolean
  group: BranchThreadGroup
  project: Project
  onAction: DesktopActionInvoker
}) {
  const execution = useBranchActionExecution()
  const warning = execution.warning ?? (currentBranchDirty ? dirtyBranchSwitchMessage : null)
  const switchAndCreateThread = async () => {
    execution.clearWarning()
    await execution.run({
      execute: async () => {
        const switchResult = await onAction('workspace.switch-branch', {
          projectId: project.id,
          value: group.label,
        })
        const switchFailure = getDesktopBranchActionFailure(
          switchResult,
          'Could not switch branch.',
        )
        if (switchFailure) return { failure: switchFailure }
        const threadResult = await createThreadForBranch({
          branchName: group.label,
          onAction,
          projectId: project.id,
        })
        return {
          failure: getDesktopBranchActionFailure(threadResult, 'Could not start a new session.'),
        }
      },
      getFailure: (result) => result.failure,
    })
  }
  return (
    <div className="sidebar-project-work-empty-branch-row">
      <span className="sidebar-project-work-empty-branch-spacer" aria-hidden="true" />
      <span>No sessions in this branch.</span>
      <SidebarActionTooltip
        description="Switch branches and start a new session."
        warning={warning}
      >
        <button
          type="button"
          className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-branch-action--optical-up sidebar-project-work-empty-start"
          data-warning={warning ? 'true' : 'false'}
          disabled={execution.pending}
          onClick={(event) => {
            event.stopPropagation()
            if (currentBranchDirty) return
            void switchAndCreateThread()
          }}
          aria-label="Switch branches and start a new session"
        >
          {execution.pending ? (
            <ActivitySpinner className="h-3 w-3 text-current" />
          ) : (
            <Plus size={12} />
          )}
        </button>
      </SidebarActionTooltip>
    </div>
  )
}

export function BranchThreadGroupSection({
  actionCapabilityOverrides,
  activeView,
  collapsed,
  currentBranch,
  currentBranchDirty = false,
  group,
  hideSessionCounts,
  project,
  selectedThreadId,
  terminalRunningSessionPaths,
  onAction,
  showBottomDivider = false,
  showTopDivider = false,
  onThreadOpen,
  onToggle,
}: {
  actionCapabilityOverrides?: Partial<BranchActionCapabilities>
  activeView: View
  collapsed: boolean
  currentBranch: string | null
  currentBranchDirty?: boolean
  group: BranchThreadGroup
  hideSessionCounts: boolean
  project: Project
  selectedThreadId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  onAction: DesktopActionInvoker
  showBottomDivider?: boolean
  showTopDivider?: boolean
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
  onToggle: () => void
}) {
  const visibilityState = getBranchGroupVisibilityState(group)
  const actionCapabilities = getBranchActionCapabilities(group, {
    canStartThread: !visibilityState.showEmptyBranchPrompt,
    ...actionCapabilityOverrides,
  })
  const branchSwitchBlocked = actionCapabilities.canSwitch && currentBranchDirty
  const threadProject = group.worktreePath ? { ...project, id: group.worktreePath } : project
  const threadAssignBranch = getThreadAssignBranchForGroup(group, currentBranch)
  const dividerState = getBranchGroupDividerState({
    collapsed,
    showBottomDivider,
    showTopDivider,
  })

  return (
    <section
      className="sidebar-project-work-branch-group"
      data-branch-group-kind="branch"
      data-current={group.current || (group.worktree && !group.worktreeComplete) ? 'true' : 'false'}
      data-divider-after={dividerState.after}
      data-divider-before={dividerState.before}
    >
      <BranchHeadingRow unassigned={group.unassigned}>
        <button
          type="button"
          className="sidebar-icon-action sidebar-icon-action--xs sidebar-icon-action--no-hover sidebar-project-work-branch-disclosure"
          onClick={onToggle}
          disabled={!visibilityState.canToggleGroup}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${group.label}` : `Collapse ${group.label}`}
        >
          <BranchHeadingIcon group={group} />
        </button>
        <button
          type="button"
          className="sidebar-project-work-branch-toggle"
          onClick={onToggle}
          disabled={!visibilityState.canToggleGroup}
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
        <BranchInlineActions
          capabilities={actionCapabilities}
          currentBranch={currentBranch}
          group={group}
          project={project}
          switchBlocked={branchSwitchBlocked}
          onAction={onAction}
        />
      </BranchHeadingRow>

      {collapsed || !visibilityState.showContents ? null : (
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
                  currentBranch={threadAssignBranch}
                />
              ))}
            </div>
          ) : null}
          {group.worktrees.map((worktree, index) => (
            <WorktreeGroupSection
              key={worktree.id}
              activeView={activeView}
              currentBranch={currentBranch}
              hideSessionCounts={hideSessionCounts}
              isLast={index === group.worktrees.length - 1}
              project={project}
              selectedThreadId={selectedThreadId}
              terminalRunningSessionPaths={terminalRunningSessionPaths}
              worktree={worktree}
              onAction={onAction}
              onThreadOpen={onThreadOpen}
            />
          ))}
          {visibilityState.showEmptyBranchPrompt ? (
            <EmptyBranchPrompt
              currentBranchDirty={currentBranchDirty}
              group={group}
              project={project}
              onAction={onAction}
            />
          ) : null}
        </div>
      )}
    </section>
  )
}
