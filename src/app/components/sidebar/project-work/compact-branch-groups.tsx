import { Tooltip } from '@howcode/common/tooltip'
import { CircleOff, GitBranch } from 'lucide-react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project, Thread, View } from '../../../types'
import { BranchInlineActions, BranchSessionCount } from './branch-row-actions'
import { BranchThreadGroupSection, getCompactBranchVisualGroupKey } from './branch-thread-groups'
import type { BranchThreadGroup, WorktreeBranch } from './project-work-model'
import { ProjectWorkThreadRow } from './project-work-thread-row'

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

function getUnassignedDividerBefore(input: {
  hasWorktreeGroups: boolean
  unassignedExpanded: boolean
}) {
  return input.hasWorktreeGroups && input.unassignedExpanded ? 'true' : 'false'
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
  pruneConfirmBranchId,
  selectedThreadId,
  switchErrorBranchId,
  terminalRunningSessionPaths,
  unassignedExpanded,
  unassignedThreads,
  worktreeGroups,
  onAction,
  onSetCollapsedBranchIds,
  onSetPruneConfirmBranchId,
  onSetSwitchErrorBranchId,
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
  pruneConfirmBranchId: string | null
  selectedThreadId: string | null
  switchErrorBranchId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  unassignedExpanded: boolean
  unassignedThreads: Thread[]
  worktreeGroups: BranchThreadGroup[]
  onAction: DesktopActionInvoker
  onSetCollapsedBranchIds: (
    updater: (current: Record<string, boolean>) => Record<string, boolean>,
  ) => void
  onSetPruneConfirmBranchId: (branchId: string | null) => void
  onSetSwitchErrorBranchId: (branchId: string | null) => void
  onToggleCurrentBranch: () => void
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
  onToggleUnassigned: () => void
}) {
  const canToggleCurrentBranch = branchThreads.length > 0
  const completedWorktrees = getCompletedWorktreesForCompactCurrentBranch(worktreeGroups)
  const hasCompletedWorktrees = completedWorktrees.length > 0
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
  const currentBranchActionKey = `${project.id}:${currentBranchGroup.id}`
  const mergeCompletedWorktreesActionKey = `${currentBranchActionKey}:merge-completed-worktrees`
  const removeCompletedWorktreesActionKey = `${currentBranchActionKey}:remove-completed-worktrees`
  const confirmingCurrentPrune = pruneConfirmBranchId === currentBranchActionKey
  const confirmingMergeCompletedWorktrees =
    pruneConfirmBranchId === mergeCompletedWorktreesActionKey
  const confirmingRemoveCompletedWorktrees =
    pruneConfirmBranchId === removeCompletedWorktreesActionKey
  const canPruneCurrentBranch = Boolean(currentBranch)
  const currentBranchActionCount =
    (canPruneCurrentBranch ? 1 : 0) + (hasCompletedWorktrees ? 2 : 0) + (currentBranch ? 1 : 0) + 1
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
      <section className="sidebar-project-work-branch-group" data-current="true">
        <div className="sidebar-compact-row sidebar-compact-row--branch sidebar-project-work-branch-heading">
          <button
            type="button"
            className="sidebar-icon-action sidebar-icon-action--xs sidebar-icon-action--no-hover sidebar-project-work-branch-disclosure"
            onClick={onToggleCurrentBranch}
            disabled={!canToggleCurrentBranch}
            aria-expanded={currentBranchExpanded}
            aria-label={currentBranchExpanded ? 'Collapse current branch' : 'Expand current branch'}
          >
            <GitBranch size={13} className="sidebar-project-work-branch-icon" />
          </button>
          <button
            type="button"
            className="sidebar-project-work-branch-toggle"
            onClick={onToggleCurrentBranch}
            disabled={!canToggleCurrentBranch}
            aria-expanded={currentBranchExpanded}
          >
            <span className="truncate">{currentBranch ?? 'No branch'}</span>
          </button>
          <span className="sidebar-project-work-branch-meta">
            <BranchSessionCount count={branchThreads.length} hidden={hideSessionCounts} />
          </span>
          <span
            className="sidebar-project-work-branch-actions"
            data-action-count={currentBranchActionCount}
            data-confirming={
              confirmingCurrentPrune ||
              confirmingMergeCompletedWorktrees ||
              confirmingRemoveCompletedWorktrees
                ? 'true'
                : 'false'
            }
          >
            <BranchInlineActions
              canPrune={canPruneCurrentBranch}
              canSwitch={false}
              canToggleWorktreeComplete={false}
              canMergeWorktree={false}
              canMergeCompletedWorktrees={hasCompletedWorktrees}
              canRemoveCompletedWorktrees={hasCompletedWorktrees}
              canCreateWorktree={Boolean(currentBranch)}
              confirmingPrune={confirmingCurrentPrune}
              confirmingMergeCompletedWorktrees={confirmingMergeCompletedWorktrees}
              confirmingRemoveCompletedWorktrees={confirmingRemoveCompletedWorktrees}
              currentBranch={currentBranch}
              group={currentBranchGroup}
              project={project}
              switchBlocked={false}
              onAction={onAction}
              onCancelPrune={() => onSetPruneConfirmBranchId(null)}
              onConfirmPrune={() => onSetPruneConfirmBranchId(null)}
              onRequestPruneConfirm={() => onSetPruneConfirmBranchId(currentBranchActionKey)}
              onCancelMergeCompletedWorktrees={() => onSetPruneConfirmBranchId(null)}
              onConfirmMergeCompletedWorktrees={() => onSetPruneConfirmBranchId(null)}
              onRequestMergeCompletedWorktreesConfirm={() =>
                onSetPruneConfirmBranchId(mergeCompletedWorktreesActionKey)
              }
              onCancelRemoveCompletedWorktrees={() => onSetPruneConfirmBranchId(null)}
              onConfirmRemoveCompletedWorktrees={() => onSetPruneConfirmBranchId(null)}
              onRequestRemoveCompletedWorktreesConfirm={() =>
                onSetPruneConfirmBranchId(removeCompletedWorktreesActionKey)
              }
              onSwitchBlocked={() => undefined}
              onSwitchFailed={() => undefined}
            />
          </span>
        </div>
        {currentBranchExpanded ? (
          <div className="sidebar-project-work-branch-thread-list">
            {branchThreads.map((thread) => (
              <ProjectWorkThreadRow
                key={thread.id}
                activeView={activeView}
                currentBranch={currentBranch}
                project={project}
                selectedThreadId={selectedThreadId}
                terminalRunningSessionPaths={terminalRunningSessionPaths}
                thread={thread}
                onAction={onAction}
                onThreadOpen={onThreadOpen}
              />
            ))}
          </div>
        ) : null}
      </section>

      {worktreeGroups.map((group, index) => {
        const groupKey = `${project.id}:${group.id}`
        const visualGroupKey = getCompactBranchVisualGroupKey(group, currentBranch)
        const nextGroup = index < worktreeGroups.length - 1 ? worktreeGroups[index + 1] : undefined
        const nextVisualGroupKey = nextGroup
          ? getCompactBranchVisualGroupKey(nextGroup, currentBranch)
          : null
        const collapsed = normalizedSearchQuery
          ? false
          : (collapsedBranchIds[groupKey] ??
            (group.threads.length === 0 && group.worktrees.length === 0))
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

      {unassignedThreads.length > 0 ? (
        <section
          className="sidebar-project-work-branch-group"
          data-divider-before={getUnassignedDividerBefore({
            hasWorktreeGroups: worktreeGroups.length > 0,
            unassignedExpanded,
          })}
        >
          <Tooltip
            content="Sessions not assigned to a git branch"
            className="sidebar-project-work-row-tooltip"
          >
            <div className="sidebar-compact-row sidebar-compact-row--branch sidebar-project-work-branch-heading">
              <button
                type="button"
                className="sidebar-icon-action sidebar-icon-action--xs sidebar-icon-action--no-hover sidebar-project-work-branch-disclosure"
                onClick={onToggleUnassigned}
                aria-expanded={unassignedExpanded}
                aria-label={
                  unassignedExpanded ? 'Collapse unassigned sessions' : 'Expand unassigned sessions'
                }
              >
                <CircleOff size={13} className="sidebar-project-work-unassigned-icon" />
              </button>
              <button
                type="button"
                className="sidebar-project-work-branch-toggle sidebar-project-work-branch-toggle--plain"
                onClick={onToggleUnassigned}
                aria-expanded={unassignedExpanded}
              >
                <span className="truncate">Unassigned</span>
              </button>
              <span className="sidebar-project-work-branch-meta">
                <BranchSessionCount count={unassignedThreads.length} hidden={hideSessionCounts} />
              </span>
              <span className="sidebar-project-work-branch-actions" data-action-count="1">
                <BranchInlineActions
                  canPrune={false}
                  canSwitch={false}
                  canToggleWorktreeComplete={false}
                  canMergeWorktree={false}
                  canMergeCompletedWorktrees={false}
                  canRemoveCompletedWorktrees={false}
                  canCreateWorktree={false}
                  confirmingPrune={false}
                  confirmingMergeCompletedWorktrees={false}
                  confirmingRemoveCompletedWorktrees={false}
                  currentBranch={currentBranch}
                  group={unassignedGroup}
                  project={project}
                  switchBlocked={false}
                  onAction={onAction}
                  onCancelPrune={() => undefined}
                  onConfirmPrune={() => undefined}
                  onRequestPruneConfirm={() => undefined}
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
          </Tooltip>
          {unassignedExpanded ? (
            <div className="sidebar-project-work-branch-thread-list">
              {unassignedThreads.map((thread) => (
                <ProjectWorkThreadRow
                  key={thread.id}
                  activeView={activeView}
                  currentBranch={currentBranch}
                  project={project}
                  selectedThreadId={selectedThreadId}
                  terminalRunningSessionPaths={terminalRunningSessionPaths}
                  thread={thread}
                  onAction={onAction}
                  onThreadOpen={onThreadOpen}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  )
}
