import { CircleOff, GitBranch } from 'lucide-react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project, Thread, View } from '../../../types'
import { BranchInlineActions, BranchSessionCount } from './branch-row-actions'
import { BranchThreadGroupSection } from './branch-thread-groups'
import type { BranchThreadGroup } from './project-work-model'
import { ProjectWorkThreadRow } from './project-work-thread-row'

export function ProjectCompactBranchGroups({
  activeView,
  branchThreads,
  collapsedBranchIds,
  currentBranch,
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
  const currentBranchGroup: BranchThreadGroup = {
    id: 'current-branch',
    label: currentBranch ?? 'No branch',
    threads: branchThreads,
    current: true,
    unassigned: false,
    worktree: false,
  }
  const currentBranchActionKey = `${project.id}:${currentBranchGroup.id}`
  const confirmingCurrentPrune = pruneConfirmBranchId === currentBranchActionKey
  const canPruneCurrentBranch = Boolean(currentBranch)
  const unassignedGroup: BranchThreadGroup = {
    id: 'compact-unassigned',
    label: 'Unassigned',
    threads: unassignedThreads,
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
            data-action-count={canPruneCurrentBranch ? 2 : 1}
            data-confirming={confirmingCurrentPrune ? 'true' : 'false'}
          >
            <BranchInlineActions
              canPrune={canPruneCurrentBranch}
              canSwitch={false}
              confirmingPrune={confirmingCurrentPrune}
              currentBranch={currentBranch}
              group={currentBranchGroup}
              project={project}
              switchBlocked={false}
              onAction={onAction}
              onCancelPrune={() => onSetPruneConfirmBranchId(null)}
              onConfirmPrune={() => onSetPruneConfirmBranchId(null)}
              onRequestPruneConfirm={() => onSetPruneConfirmBranchId(currentBranchActionKey)}
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

      {worktreeGroups.map((group) => {
        const groupKey = `${project.id}:${group.id}`
        const collapsed = normalizedSearchQuery
          ? false
          : (collapsedBranchIds[groupKey] ?? group.threads.length === 0)
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

      {unassignedThreads.length > 0 ? (
        <section className="sidebar-project-work-branch-group">
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
                confirmingPrune={false}
                currentBranch={currentBranch}
                group={unassignedGroup}
                project={project}
                switchBlocked={false}
                onAction={onAction}
                onCancelPrune={() => undefined}
                onConfirmPrune={() => undefined}
                onRequestPruneConfirm={() => undefined}
                onSwitchBlocked={() => undefined}
                onSwitchFailed={() => undefined}
              />
            </span>
          </div>
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
