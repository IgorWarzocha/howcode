import { Tooltip } from '@howcode/common/tooltip'
import { CircleOff, GitBranch, GitFork, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project, View } from '../../../types'
import { BranchInlineActions, BranchSessionCount } from './branch-row-actions'
import { createThreadForBranch } from './new-thread-menu'
import type { BranchThreadGroup, WorktreeBranchGroup } from './project-work-model'
import { ProjectWorkThreadRow } from './project-work-thread-row'

const dirtyBranchSwitchMessage =
  'You have uncommitted changes on your current branch. Commit first.'

function BranchHeadingIcon({ group }: { group: BranchThreadGroup }) {
  if (group.unassigned) {
    return <CircleOff size={13} className="sidebar-project-work-unassigned-icon" />
  }
  if (group.worktree) {
    return <GitFork size={13} className="sidebar-project-work-branch-icon" />
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

function hasCompletedWorktrees(group: BranchThreadGroup) {
  return (
    (group.completedWorktrees?.length ?? 0) > 0 ||
    group.worktrees.some((worktree) => worktree.complete)
  )
}

function hasMergeableCompletedWorktrees(group: BranchThreadGroup) {
  return (
    (group.completedWorktrees?.some((worktree) => Boolean(worktree.branchName)) ?? false) ||
    group.worktrees.some((worktree) => worktree.complete && Boolean(worktree.branchName))
  )
}

function getBranchActionState(input: {
  group: BranchThreadGroup
  projectId: string
  pruneConfirmBranchId: string | null
}) {
  const { group, projectId, pruneConfirmBranchId } = input
  const canPruneBranch = !group.unassigned
  const canSwitchBranch = !(group.current || group.unassigned || group.worktree)
  const canToggleWorktreeComplete = group.worktree
  const canMergeWorktree = group.worktree && Boolean(group.worktreeBranchName)
  const canMergeCompletedWorktrees = !group.worktree && hasMergeableCompletedWorktrees(group)
  const canRemoveCompletedWorktrees = !group.worktree && hasCompletedWorktrees(group)
  const branchActionKey = `${projectId}:${group.id}`
  const mergeCompletedWorktreesActionKey = `${branchActionKey}:merge-completed-worktrees`
  const removeCompletedWorktreesActionKey = `${branchActionKey}:remove-completed-worktrees`
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
    mergeCompletedWorktreesActionKey,
    removeCompletedWorktreesActionKey,
    canPruneBranch,
    canSwitchBranch,
    canToggleWorktreeComplete,
    canMergeWorktree,
    canMergeCompletedWorktrees,
    canRemoveCompletedWorktrees,
    confirmingPrune: pruneConfirmBranchId === branchActionKey,
    confirmingMergeCompletedWorktrees: pruneConfirmBranchId === mergeCompletedWorktreesActionKey,
    confirmingRemoveCompletedWorktrees: pruneConfirmBranchId === removeCompletedWorktreesActionKey,
  }
}

export function getCompactBranchVisualGroupKey(
  group: BranchThreadGroup,
  currentBranch: string | null,
) {
  return group.worktree ? (group.worktreeBranchName ?? group.label ?? currentBranch) : group.label
}

function getBranchVisualGroupKey(group: BranchThreadGroup) {
  if (group.unassigned) return 'unassigned'
  return group.label
}

export function shouldSeparateBranchGroups(
  group: BranchThreadGroup,
  nextGroup: BranchThreadGroup | undefined,
) {
  if (!nextGroup) return false
  const groupIsCheckoutCluster = group.current || group.worktree || group.worktrees.length > 0
  const nextGroupIsCheckoutCluster =
    nextGroup.current || nextGroup.worktree || nextGroup.worktrees.length > 0
  return groupIsCheckoutCluster && !nextGroupIsCheckoutCluster
}

function getThreadAssignBranchForGroup(group: BranchThreadGroup, currentBranch: string | null) {
  if (!group.worktree) return currentBranch
  return group.worktreeBranchName ?? null
}

function getBranchGroupDividerState(input: {
  collapsed: boolean
  hasWorktrees: boolean
  showBottomDivider: boolean
  showTopDivider: boolean
}) {
  if (input.collapsed) return { before: 'false', after: 'false' }
  return {
    before: input.showTopDivider || input.hasWorktrees ? 'true' : 'false',
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

function getBranchSwitchBlocked(input: {
  actionCanSwitch: boolean
  currentBranchDirty: boolean
  switchBlocked: boolean
}) {
  if (input.switchBlocked) return true
  return input.actionCanSwitch && input.currentBranchDirty
}

function EmptyBranchPrompt({
  currentBranchDirty,
  group,
  project,
  onAction,
  onSwitchError,
}: {
  currentBranchDirty: boolean
  group: BranchThreadGroup
  project: Project
  onAction: DesktopActionInvoker
  onSwitchError: () => void
}) {
  const tooltip = currentBranchDirty
    ? dirtyBranchSwitchMessage
    : 'Switch branches and start a new session.'
  return (
    <div className="sidebar-project-work-empty-branch-row">
      <span>No sessions in this branch.</span>
      <Tooltip content={tooltip} placement="right">
        <button
          type="button"
          className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-empty-start"
          data-warning={currentBranchDirty ? 'true' : 'false'}
          onClick={(event) => {
            event.stopPropagation()
            if (currentBranchDirty) return
            void onAction('workspace.switch-branch', {
              projectId: project.id,
              value: group.label,
            }).then((result) => {
              if (result?.result?.error) {
                onSwitchError()
                return
              }
              void createThreadForBranch({
                branchName: group.label,
                onAction,
                projectId: project.id,
              })
            })
          }}
          aria-label="Switch branches and start a new session"
        >
          <Plus size={12} />
        </button>
      </Tooltip>
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
  pruneConfirmBranchId,
  onSetPruneConfirmBranchId,
  switchErrorBranchId,
  onSetSwitchErrorBranchId,
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
  const branchSwitchBlocked = getBranchSwitchBlocked({
    actionCanSwitch: actionState.canSwitchBranch,
    currentBranchDirty,
    switchBlocked,
  })
  const threadProject = group.worktreePath ? { ...project, id: group.worktreePath } : project
  const threadAssignBranch = getThreadAssignBranchForGroup(group, currentBranch)
  const visibilityState = getBranchGroupVisibilityState(group)
  const dividerState = getBranchGroupDividerState({
    collapsed,
    hasWorktrees: visibilityState.hasWorktrees,
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
        <span
          className="sidebar-project-work-branch-actions"
          data-action-count={actionState.actionCount}
          data-confirming={
            actionState.confirmingPrune ||
            actionState.confirmingMergeCompletedWorktrees ||
            actionState.confirmingRemoveCompletedWorktrees
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
            confirmingMergeCompletedWorktrees={actionState.confirmingMergeCompletedWorktrees}
            confirmingRemoveCompletedWorktrees={actionState.confirmingRemoveCompletedWorktrees}
            currentBranch={currentBranch}
            group={group}
            project={project}
            switchBlocked={branchSwitchBlocked}
            onAction={onAction}
            onCancelPrune={() => onSetPruneConfirmBranchId(null)}
            onConfirmPrune={() => onSetPruneConfirmBranchId(null)}
            onRequestPruneConfirm={() => onSetPruneConfirmBranchId(actionState.branchActionKey)}
            onCancelMergeCompletedWorktrees={() => onSetPruneConfirmBranchId(null)}
            onConfirmMergeCompletedWorktrees={() => onSetPruneConfirmBranchId(null)}
            onRequestMergeCompletedWorktreesConfirm={() =>
              onSetPruneConfirmBranchId(actionState.mergeCompletedWorktreesActionKey)
            }
            onCancelRemoveCompletedWorktrees={() => onSetPruneConfirmBranchId(null)}
            onConfirmRemoveCompletedWorktrees={() => onSetPruneConfirmBranchId(null)}
            onRequestRemoveCompletedWorktreesConfirm={() =>
              onSetPruneConfirmBranchId(actionState.removeCompletedWorktreesActionKey)
            }
            onSwitchBlocked={() => onSetSwitchErrorBranchId(actionState.branchActionKey)}
            onSwitchFailed={() => onSetSwitchErrorBranchId(null)}
          />
        </span>
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
              pruneConfirmBranchId={pruneConfirmBranchId}
              onSetPruneConfirmBranchId={onSetPruneConfirmBranchId}
            />
          ))}
          {visibilityState.showEmptyBranchPrompt ? (
            <EmptyBranchPrompt
              currentBranchDirty={currentBranchDirty}
              group={group}
              project={project}
              onAction={onAction}
              onSwitchError={() => onSetSwitchErrorBranchId(`${project.id}:${group.id}`)}
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
  pruneConfirmBranchId,
  onSetPruneConfirmBranchId,
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
  pruneConfirmBranchId: string | null
  onSetPruneConfirmBranchId: (branchId: string | null) => void
}) {
  const worktreeActionKey = `${project.id}:${worktree.id}`
  const confirmingPrune = pruneConfirmBranchId === worktreeActionKey
  const threadProject = { ...project, id: worktree.path }
  const threadAssignBranch = worktree.branchName ?? null
  const worktreeHasBranch = Boolean(worktree.branchName)
  const worktreeActionCount = (worktreeHasBranch ? 2 : 0) + 2
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

  return (
    <section
      className="sidebar-project-work-worktree-group"
      data-branch-group-kind="worktree"
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
          data-action-count={worktreeActionCount}
          data-confirming={confirmingPrune ? 'true' : 'false'}
        >
          <BranchInlineActions
            canPrune={worktreeHasBranch}
            canSwitch={false}
            canToggleWorktreeComplete={true}
            canMergeWorktree={worktreeHasBranch}
            canMergeCompletedWorktrees={false}
            canRemoveCompletedWorktrees={false}
            confirmingPrune={confirmingPrune}
            confirmingMergeCompletedWorktrees={false}
            confirmingRemoveCompletedWorktrees={false}
            currentBranch={currentBranch}
            group={worktreeGroup}
            project={project}
            switchBlocked={false}
            onAction={onAction}
            onCancelPrune={() => onSetPruneConfirmBranchId(null)}
            onConfirmPrune={() => onSetPruneConfirmBranchId(null)}
            onRequestPruneConfirm={() => onSetPruneConfirmBranchId(worktreeActionKey)}
            onCancelMergeCompletedWorktrees={() => undefined}
            onConfirmMergeCompletedWorktrees={() => undefined}
            onRequestMergeCompletedWorktreesConfirm={() => undefined}
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
  currentBranchDirty?: boolean
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
      {branchGroups.map((group, index) => {
        const groupKey = `${project.id}:${group.id}`
        const visualGroupKey = getBranchVisualGroupKey(group)
        const nextGroup = index < branchGroups.length - 1 ? branchGroups[index + 1] : undefined
        const nextVisualGroupKey = nextGroup ? getBranchVisualGroupKey(nextGroup) : null
        const defaultCollapsed = !(group.current || group.worktrees.length > 0)
        const collapsed = normalizedSearchQuery
          ? false
          : (collapsedBranchIds[groupKey] ?? defaultCollapsed)
        const showBottomDivider =
          !collapsed && nextVisualGroupKey !== null && visualGroupKey !== nextVisualGroupKey
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
