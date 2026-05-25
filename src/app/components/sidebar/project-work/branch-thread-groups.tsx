import { Tooltip } from '@howcode/common/tooltip'
import { ChevronDown, ChevronRight, GitBranch, Trash2, X } from 'lucide-react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project, Thread, View } from '../../../types'
import type { BranchThreadGroup } from './project-work-model'
import { ProjectWorkThreadRow } from './project-work-thread-row'

function BranchSwitchAction({
  blocked,
  group,
  project,
  onAction,
  onBlocked,
}: {
  blocked: boolean
  group: BranchThreadGroup
  project: Project
  onAction: DesktopActionInvoker
  onBlocked: () => void
}) {
  return (
    <Tooltip
      content={blocked ? 'Worktree is dirty. Commit first.' : `Switch to ${group.label}`}
      placement="right"
    >
      <button
        type="button"
        className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action"
        onClick={(event) => {
          event.stopPropagation()
          void onAction('workspace.switch-branch', {
            projectId: project.id,
            value: group.label,
          }).then((result) => {
            const error = result?.result?.error
            if (typeof error === 'string' && error.includes('Worktree is dirty')) onBlocked()
          })
        }}
        aria-label={`Switch to ${group.label}`}
      >
        <GitBranch size={12} />
      </button>
    </Tooltip>
  )
}

function BranchPruneAction({
  group,
  project,
  confirming,
  onAction,
  onCancel,
  onConfirm,
  onRequestConfirm,
}: {
  group: BranchThreadGroup
  project: Project
  confirming: boolean
  onAction: DesktopActionInvoker
  onCancel: () => void
  onConfirm: () => void
  onRequestConfirm: () => void
}) {
  if (confirming) {
    return (
      <>
        <button
          type="button"
          className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action"
          onClick={(event) => {
            event.stopPropagation()
            onCancel()
          }}
          aria-label="Cancel prune"
        >
          <X size={12} />
        </button>
        <button
          type="button"
          className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-branch-action--danger"
          onClick={(event) => {
            event.stopPropagation()
            onConfirm()
            void onAction('workspace.prune-branch', {
              projectId: project.id,
              branchName: group.label,
            })
          }}
          aria-label={`Confirm prune ${group.label}`}
        >
          <Trash2 size={12} />
        </button>
      </>
    )
  }

  return (
    <Tooltip content={`Prune ${group.label}`} placement="right">
      <button
        type="button"
        className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action"
        onClick={(event) => {
          event.stopPropagation()
          onRequestConfirm()
        }}
        aria-label={`Prune ${group.label}`}
      >
        <Trash2 size={12} />
      </button>
    </Tooltip>
  )
}

export function BranchThreadGroupSection({
  activeView,
  collapsed,
  currentBranch,
  group,
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
  const canManageBranch = !(group.current || group.unassigned)
  const confirmingPrune = pruneConfirmBranchId === group.id
  const switchBlocked = switchErrorBranchId === group.id

  return (
    <section
      className="sidebar-project-work-branch-group"
      data-current={group.current ? 'true' : 'false'}
    >
      <div className="sidebar-compact-row sidebar-compact-row--branch sidebar-project-work-branch-heading">
        <button
          type="button"
          className="sidebar-icon-action sidebar-icon-action--xs sidebar-project-work-branch-disclosure"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${group.label}` : `Collapse ${group.label}`}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        </button>
        <button
          type="button"
          className="sidebar-project-work-branch-toggle"
          onClick={onToggle}
          aria-expanded={!collapsed}
        >
          {/* TODO(worktrees): swap this for a dynamic work-context icon once worktrees land. Branches can keep GitBranch; worktrees likely need a custom SVG. */}
          <GitBranch size={13} className="sidebar-project-work-branch-icon" />
          <span className="truncate">{group.label}</span>
        </button>
        <span className="sidebar-project-work-branch-meta">
          {group.current ? (
            <span className="sidebar-project-work-branch-current">Current</span>
          ) : null}
          <span className="sidebar-project-work-branch-count">{group.threads.length}</span>
        </span>
        <span
          className="sidebar-project-work-branch-actions"
          data-confirming={confirmingPrune ? 'true' : 'false'}
        >
          {canManageBranch && !confirmingPrune ? (
            <BranchSwitchAction
              blocked={switchBlocked}
              group={group}
              project={project}
              onAction={onAction}
              onBlocked={() => onSetSwitchErrorBranchId(group.id)}
            />
          ) : null}
          {canManageBranch ? (
            <BranchPruneAction
              confirming={confirmingPrune}
              group={group}
              project={project}
              onAction={onAction}
              onCancel={() => onSetPruneConfirmBranchId(null)}
              onConfirm={() => onSetPruneConfirmBranchId(null)}
              onRequestConfirm={() => onSetPruneConfirmBranchId(group.id)}
            />
          ) : null}
        </span>
      </div>

      {collapsed ? null : (
        <div className="sidebar-project-work-branch-thread-list">
          {group.threads.length > 0 ? (
            group.threads.map((thread) => (
              <ProjectWorkThreadRow
                key={thread.id}
                activeView={activeView}
                project={project}
                selectedThreadId={selectedThreadId}
                terminalRunningSessionPaths={terminalRunningSessionPaths}
                thread={thread}
                onAction={onAction}
                onThreadOpen={onThreadOpen}
                currentBranch={currentBranch}
              />
            ))
          ) : (
            <div className="sidebar-project-work-branch-empty">No threads assigned here yet.</div>
          )}
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

export function ProjectCompactBranchGroups({
  activeView,
  branchThreads,
  currentBranch,
  currentBranchExpanded,
  project,
  selectedThreadId,
  terminalRunningSessionPaths,
  unassignedExpanded,
  unassignedThreads,
  onAction,
  onToggleCurrentBranch,
  onThreadOpen,
  onToggleUnassigned,
}: {
  activeView: View
  branchThreads: Thread[]
  currentBranch: string | null
  currentBranchExpanded: boolean
  project: Project
  selectedThreadId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  unassignedExpanded: boolean
  unassignedThreads: Thread[]
  onAction: DesktopActionInvoker
  onToggleCurrentBranch: () => void
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
  onToggleUnassigned: () => void
}) {
  return (
    <>
      <section className="sidebar-project-work-branch-group" data-current="true">
        <div className="sidebar-compact-row sidebar-compact-row--branch sidebar-project-work-branch-heading">
          <button
            type="button"
            className="sidebar-icon-action sidebar-icon-action--xs sidebar-project-work-branch-disclosure"
            onClick={onToggleCurrentBranch}
            aria-expanded={currentBranchExpanded}
            aria-label={currentBranchExpanded ? 'Collapse current branch' : 'Expand current branch'}
          >
            {currentBranchExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          <button
            type="button"
            className="sidebar-project-work-branch-toggle"
            onClick={onToggleCurrentBranch}
            aria-expanded={currentBranchExpanded}
          >
            <GitBranch size={13} className="sidebar-project-work-branch-icon" />
            <span className="truncate">{currentBranch ?? 'No branch'}</span>
          </button>
          <span className="sidebar-project-work-branch-meta">
            <span className="sidebar-project-work-branch-count">{branchThreads.length}</span>
          </span>
        </div>
        {currentBranchExpanded ? (
          <div className="sidebar-project-work-branch-thread-list">
            {branchThreads.length > 0 ? (
              branchThreads.map((thread) => (
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
              ))
            ) : (
              <div className="sidebar-project-work-branch-empty">No threads on current branch.</div>
            )}
          </div>
        ) : null}
      </section>

      {unassignedThreads.length > 0 ? (
        <section className="sidebar-project-work-branch-group">
          <div className="sidebar-compact-row sidebar-compact-row--branch sidebar-project-work-branch-heading">
            <button
              type="button"
              className="sidebar-icon-action sidebar-icon-action--xs sidebar-project-work-branch-disclosure"
              onClick={onToggleUnassigned}
              aria-expanded={unassignedExpanded}
              aria-label={
                unassignedExpanded ? 'Collapse unassigned sessions' : 'Expand unassigned sessions'
              }
            >
              {unassignedExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
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
              <span className="sidebar-project-work-branch-count">{unassignedThreads.length}</span>
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
