import { Tooltip } from '@howcode/common/tooltip'
import { CircleOff, GitBranch, Plus } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project, View } from '../../../types'
import { WorktreeSmallIcon } from '../../../ui/icons/worktree-small-icon'
import { SidebarActionTooltip } from '../sidebar-action-tooltip'
import { getBranchActionCapabilities, getBranchActionCount } from './branch-action-capabilities'
import {
  shouldShowBranchGroupDividerAfter,
  shouldShowBranchGroupDividerBefore,
} from './branch-group-layout'
import type { BranchThreadGroup, WorktreeBranchGroup } from './branch-group-model'
import { BranchInlineActions, BranchSessionCount } from './branch-row-actions'
import { createThreadForBranch } from './new-thread-actions'
import { ProjectWorkThreadRow } from './project-work-thread-row'

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

function BranchHeadingLabel({ group }: { group: BranchThreadGroup }) {
  return <span className="truncate">{group.label}</span>
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

function isEmptySwitchableBranch(group: BranchThreadGroup) {
  return !(group.current || group.unassigned || group.worktree)
}

function getBranchGroupVisibilityState(group: BranchThreadGroup) {
  const canToggleThreads = group.threads.length > 0
  const hasWorktrees = group.worktrees.length > 0
  const emptySwitchableBranch = isEmptySwitchableBranch(group)
  const showEmptyBranchPrompt = !(canToggleThreads || hasWorktrees) && emptySwitchableBranch
  return {
    canToggleThreads,
    hasWorktrees,
    showEmptyBranchPrompt,
    canToggleGroup: canToggleThreads || hasWorktrees || emptySwitchableBranch,
    showContents: canToggleThreads || hasWorktrees || showEmptyBranchPrompt,
  }
}

function EmptyBranchPrompt({
  actionCount,
  currentBranchDirty,
  group,
  project,
  onAction,
}: {
  actionCount: number
  currentBranchDirty: boolean
  group: BranchThreadGroup
  project: Project
  onAction: DesktopActionInvoker
}) {
  const tooltip = 'Switch branches and start a new session.'
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const warning = errorMessage ?? (currentBranchDirty ? dirtyBranchSwitchMessage : null)
  const switchAndCreateThread = async () => {
    setErrorMessage(null)
    const result = await onAction('workspace.switch-branch', {
      projectId: project.id,
      value: group.label,
    })
    if (result?.result?.error) {
      setErrorMessage(result.result.error)
      return
    }
    await createThreadForBranch({
      branchName: group.label,
      onAction,
      projectId: project.id,
    })
  }
  return (
    <div className="sidebar-project-work-empty-branch-row" data-action-count={actionCount}>
      <span className="sidebar-project-work-empty-branch-spacer" aria-hidden="true" />
      <span>No sessions in this branch.</span>
      <SidebarActionTooltip description={tooltip} warning={warning}>
        <button
          type="button"
          className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-branch-action--optical-up sidebar-project-work-empty-start"
          data-warning={currentBranchDirty ? 'true' : 'false'}
          onClick={(event) => {
            event.stopPropagation()
            if (currentBranchDirty) return
            void switchAndCreateThread()
          }}
          aria-label="Switch branches and start a new session"
        >
          <Plus size={12} />
        </button>
      </SidebarActionTooltip>
    </div>
  )
}

export function BranchThreadGroupSection({
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
  const actionCapabilities = getBranchActionCapabilities(group)
  const branchSwitchBlocked = actionCapabilities.canSwitch && currentBranchDirty
  const threadProject = group.worktreePath ? { ...project, id: group.worktreePath } : project
  const threadAssignBranch = getThreadAssignBranchForGroup(group, currentBranch)
  const visibilityState = getBranchGroupVisibilityState(group)
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
          <BranchHeadingLabel group={group} />
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
              actionCount={getBranchActionCount(actionCapabilities)}
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

function WorktreeGroupSection({
  activeView,
  currentBranch,
  hideSessionCounts,
  isLast,
  project,
  selectedThreadId,
  terminalRunningSessionPaths,
  worktree,
  onAction,
  onThreadOpen,
}: {
  activeView: View
  currentBranch: string | null
  hideSessionCounts: boolean
  isLast: boolean
  project: Project
  selectedThreadId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  worktree: WorktreeBranchGroup
  onAction: DesktopActionInvoker
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
}) {
  const threadProject = { ...project, id: worktree.path }
  const threadAssignBranch = worktree.branchName ?? null
  const worktreeHasBranch = Boolean(worktree.branchName)
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
    worktreeBranchName: worktree.branchName ?? null,
  }
  const actionCapabilities = getBranchActionCapabilities(worktreeGroup, {
    canPrune: worktreeHasBranch,
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
          <BranchSessionCount count={worktree.threads.length} hidden={hideSessionCounts} />
        </span>
        <BranchInlineActions
          capabilities={actionCapabilities}
          currentBranch={currentBranch}
          group={worktreeGroup}
          project={project}
          switchBlocked={false}
          onAction={onAction}
        />
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
              currentBranch={threadAssignBranch}
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
  currentBranchDirty = false,
  hideSessionCounts,
  normalizedSearchQuery,
  project,
  selectedThreadId,
  terminalRunningSessionPaths,
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
  terminalRunningSessionPaths: ReadonlySet<string>
  onAction: DesktopActionInvoker
  onSetCollapsedBranchIds: (
    updater: (current: Record<string, boolean>) => Record<string, boolean>,
  ) => void
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
}) {
  return (
    <div className="sidebar-project-work-project-expanded-branches">
      {branchGroups.map((group, index) => {
        const groupKey = `${project.id}:${group.id}`
        const hasNextGroup = index < branchGroups.length - 1
        const defaultCollapsed = !(group.current || group.worktrees.length > 0)
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
    </div>
  )
}
