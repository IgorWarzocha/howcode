import { Tooltip } from '@howcode/common/tooltip'
import { CircleOff, GitBranch } from 'lucide-react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project, Thread, View } from '../../../types'
import { getBranchActionCapabilities } from './branch-action-capabilities'
import {
  shouldShowBranchGroupDividerAfter,
  shouldShowBranchGroupDividerBefore,
} from './branch-group-layout'
import { BranchInlineActions, BranchSessionCount } from './branch-row-actions'
import { BranchThreadGroupSection } from './branch-thread-groups'
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
  const canToggleCurrentBranch = branchThreads.length > 0
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
  const canPruneCurrentBranch = Boolean(currentBranch)
  const unassignedGroup: BranchThreadGroup = {
    id: 'compact-unassigned',
    label: 'Unassigned',
    threads: unassignedThreads,
    worktrees: [],
    current: false,
    unassigned: true,
    worktree: false,
  }
  const currentBranchActionCapabilities = getBranchActionCapabilities(currentBranchGroup, {
    canPrune: canPruneCurrentBranch,
    canCreateWorktree: Boolean(currentBranch),
  })
  const unassignedActionCapabilities = getBranchActionCapabilities(unassignedGroup)

  return (
    <>
      <section
        className="sidebar-project-work-branch-group"
        data-current="true"
        data-divider-after={worktreeGroups.length > 0 ? 'true' : 'false'}
        data-divider-before="false"
      >
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
          <BranchInlineActions
            capabilities={currentBranchActionCapabilities}
            currentBranch={currentBranch}
            group={currentBranchGroup}
            project={project}
            switchBlocked={false}
            onAction={onAction}
          />
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
              <BranchInlineActions
                capabilities={unassignedActionCapabilities}
                currentBranch={currentBranch}
                group={unassignedGroup}
                project={project}
                switchBlocked={false}
                onAction={onAction}
              />
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
