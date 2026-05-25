import { Tooltip } from '@howcode/common/tooltip'
import { CircleOff, GitBranch, GitFork, Plus } from 'lucide-react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project, Thread, View } from '../../../types'
import { BranchPruneAction, BranchSwitchAction } from './branch-actions'
import { createThreadForBranch } from './new-thread-menu'
import type { BranchThreadGroup } from './project-work-model'
import { ProjectWorkThreadRow } from './project-work-thread-row'

function getStartThreadBranchName(group: BranchThreadGroup, currentBranch: string | null) {
  if (group.current) return currentBranch
  if (group.unassigned) return null
  return group.label
}

function EmptyBranchStartAction({
  blocked,
  currentBranch,
  group,
  project,
  onAction,
  onBlocked,
  onSwitchFailed,
}: {
  blocked: boolean
  currentBranch: string | null
  group: BranchThreadGroup
  project: Project
  onAction: DesktopActionInvoker
  onBlocked: () => void
  onSwitchFailed: () => void
}) {
  const targetProjectId = group.worktreePath ?? project.id
  const startThread = async () => {
    if (!(group.current || group.worktree || group.unassigned)) {
      const switchResult = await onAction('workspace.switch-branch', {
        projectId: project.id,
        value: group.label,
      })
      const switchError = switchResult?.result?.error
      if (switchError) {
        if (typeof switchError === 'string' && switchError.includes('Worktree is dirty')) {
          onBlocked()
          return
        }
        onSwitchFailed()
        return
      }
    }

    await createThreadForBranch({
      branchName: getStartThreadBranchName(group, currentBranch),
      onAction,
      projectId: targetProjectId,
    })
  }

  const label = group.worktree
    ? `Start thread in ${group.label}`
    : group.current
      ? `Start thread on ${currentBranch ?? group.label}`
      : `Switch to ${group.label} and start thread`

  return (
    <Tooltip content={blocked ? 'Worktree is dirty. Commit first.' : label} placement="right">
      <button
        type="button"
        className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-empty-start"
        data-warning={blocked ? 'true' : 'false'}
        onClick={(event) => {
          event.stopPropagation()
          void startThread()
        }}
        aria-label={label}
      >
        <Plus size={12} />
      </button>
    </Tooltip>
  )
}

function BranchInlineActions({
  canPrune,
  canSwitch,
  confirmingPrune,
  currentBranch,
  group,
  project,
  switchBlocked,
  onAction,
  onCancelPrune,
  onConfirmPrune,
  onRequestPruneConfirm,
  onSwitchBlocked,
  onSwitchFailed,
}: {
  canPrune: boolean
  canSwitch: boolean
  confirmingPrune: boolean
  currentBranch: string | null
  group: BranchThreadGroup
  project: Project
  switchBlocked: boolean
  onAction: DesktopActionInvoker
  onCancelPrune: () => void
  onConfirmPrune: () => void
  onRequestPruneConfirm: () => void
  onSwitchBlocked: () => void
  onSwitchFailed: () => void
}) {
  return (
    <>
      {canPrune ? (
        <BranchPruneAction
          confirming={confirmingPrune}
          group={group}
          project={project}
          onAction={onAction}
          onCancel={onCancelPrune}
          onConfirm={onConfirmPrune}
          onRequestConfirm={onRequestPruneConfirm}
        />
      ) : null}
      {confirmingPrune ? null : (
        <>
          {canSwitch ? (
            <BranchSwitchAction
              blocked={switchBlocked}
              group={group}
              project={project}
              onAction={onAction}
              onBlocked={onSwitchBlocked}
              onSwitchFailed={onSwitchFailed}
            />
          ) : null}
          <EmptyBranchStartAction
            blocked={switchBlocked}
            currentBranch={currentBranch}
            group={group}
            project={project}
            onAction={onAction}
            onBlocked={onSwitchBlocked}
            onSwitchFailed={onSwitchFailed}
          />
        </>
      )}
    </>
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
  const canPruneBranch = !group.unassigned
  const canSwitchBranch = !(group.current || group.unassigned || group.worktree)
  const actionCount = canPruneBranch && canSwitchBranch ? 3 : canPruneBranch ? 2 : 1
  const branchActionKey = `${project.id}:${group.id}`
  const confirmingPrune = pruneConfirmBranchId === branchActionKey
  const switchBlocked = switchErrorBranchId === branchActionKey
  const threadProject = group.worktreePath ? { ...project, id: group.worktreePath } : project

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
          aria-expanded={!collapsed}
        >
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
  collapsedBranchIds,
  currentBranch,
  currentBranchExpanded,
  normalizedSearchQuery,
  project,
  selectedThreadId,
  switchErrorBranchId,
  terminalRunningSessionPaths,
  unassignedExpanded,
  unassignedThreads,
  worktreeGroups,
  onAction,
  onSetCollapsedBranchIds,
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
  normalizedSearchQuery: string
  project: Project
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
  onSetSwitchErrorBranchId: (branchId: string | null) => void
  onToggleCurrentBranch: () => void
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
  onToggleUnassigned: () => void
}) {
  const currentBranchGroup: BranchThreadGroup = {
    id: 'current-branch',
    label: currentBranch ?? 'No branch',
    threads: branchThreads,
    current: true,
    unassigned: false,
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
            aria-expanded={currentBranchExpanded}
            aria-label={currentBranchExpanded ? 'Collapse current branch' : 'Expand current branch'}
          >
            <GitBranch size={13} className="sidebar-project-work-branch-icon" />
          </button>
          <button
            type="button"
            className="sidebar-project-work-branch-toggle"
            onClick={onToggleCurrentBranch}
            aria-expanded={currentBranchExpanded}
          >
            <span className="truncate">{currentBranch ?? 'No branch'}</span>
          </button>
          <span className="sidebar-project-work-branch-meta">
            <span className="sidebar-project-work-branch-count">{branchThreads.length}</span>
          </span>
          <span className="sidebar-project-work-branch-actions" data-action-count="1">
            <BranchInlineActions
              canPrune={true}
              canSwitch={false}
              confirmingPrune={false}
              currentBranch={currentBranch}
              group={currentBranchGroup}
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
        {currentBranchExpanded ? (
          <div className="sidebar-project-work-branch-thread-list">
            {branchThreads.length > 0
              ? branchThreads.map((thread) => (
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
              : null}
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
            pruneConfirmBranchId={null}
            onSetPruneConfirmBranchId={() => undefined}
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
