import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project, View } from '../../../types'
import { WorktreeSmallIcon } from '../../../ui/icons/worktree-small-icon'
import { getBranchActionCapabilities } from './branch-action-capabilities'
import type { BranchThreadGroup, WorktreeBranchGroup } from './branch-group-model'
import { BranchInlineActions, BranchSessionCount } from './branch-row-actions'
import { ProjectWorkThreadRow } from './project-work-thread-row'

export function WorktreeGroupSection({
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
