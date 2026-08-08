import { Archive, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project, Thread, View } from '../../../types'
import { appToneSubtleClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import {
  type BranchThreadGroup,
  branchGroupBelongsToBranch,
  filterBranchGroups,
  projectBlockMatchesSearch,
} from './branch-group-model'
import { ProjectExpandedBranchGroups } from './branch-thread-groups'
import { ProjectCompactBranchGroups } from './compact-branch-groups'
import { NewThreadMenu } from './new-thread-menu'
import { ProjectBrandIcon } from './project-brand-icon'
import {
  filterThreadsBySearch,
  filterThreadsForCurrentBranch,
  sortThreads,
} from './project-thread-model'
import { ProjectWorkActionsMenuButton } from './project-work-actions-menu'
import { ProjectRenameField } from './project-work-fields'
import { ProjectWorkThreadRow } from './project-work-thread-row'

function ProjectWorkBlockHeader({
  currentBranch,
  expanded,
  isGitRepo,
  project,
  onAction,
  onFocusProject,
  onToggleExpanded,
}: {
  currentBranch: string | null
  expanded: boolean
  isGitRepo: boolean
  project: Project
  onAction: DesktopActionInvoker
  onFocusProject: (projectId: string) => void
  onToggleExpanded: () => void
}) {
  const [renameDraft, setRenameDraft] = useState(project.name)
  const [editingName, setEditingName] = useState(false)
  const submitRename = () => {
    const nextName = renameDraft.trim()
    setEditingName(false)
    if (!nextName || nextName === project.name) {
      setRenameDraft(project.name)
      return
    }
    void onAction('project.edit-name', { projectId: project.id, projectName: nextName })
  }
  const handleHeadingClick = () => {
    onFocusProject(project.id)
    onToggleExpanded()
  }

  return (
    <div className="sidebar-project-work-project-block-heading-row">
      <button
        type="button"
        className="sidebar-icon-action sidebar-icon-action--md sidebar-icon-action--no-hover sidebar-project-work-project-block-disclosure"
        onClick={handleHeadingClick}
        aria-expanded={expanded}
        aria-label={expanded ? `Collapse ${project.name}` : `Expand ${project.name}`}
      >
        <ProjectBrandIcon project={project} />
      </button>
      {editingName ? (
        <div className="sidebar-project-work-project-block-heading">
          <ProjectRenameField
            projectName={project.name}
            renameDraft={renameDraft}
            onCancel={() => {
              setRenameDraft(project.name)
              setEditingName(false)
            }}
            onChange={setRenameDraft}
            onSubmit={submitRename}
          />
        </div>
      ) : (
        <button
          type="button"
          className="sidebar-project-work-project-block-heading"
          onClick={handleHeadingClick}
        >
          <span className="truncate">{project.name}</span>
        </button>
      )}
      <ProjectWorkActionsMenuButton
        project={project}
        onAction={onAction}
        onRename={() => {
          setRenameDraft(project.name)
          setEditingName(true)
        }}
      />
      <NewThreadMenu
        currentBranch={currentBranch}
        isGitRepo={isGitRepo}
        onAction={onAction}
        projectId={project.id}
      />
    </div>
  )
}

function NonGitProjectBlockThreads({
  activeView,
  project,
  searchQuery,
  selectedThreadId,
  terminalRunningSessionPaths,
  threads,
  onAction,
  onThreadOpen,
}: {
  activeView: View
  project: Project
  searchQuery: string
  selectedThreadId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  threads: Thread[]
  onAction: DesktopActionInvoker
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
}) {
  return (
    <div className="sidebar-project-work-thread-list">
      {filterThreadsBySearch(sortThreads(threads), searchQuery).map((thread) => (
        <ProjectWorkThreadRow
          key={thread.id}
          activeView={activeView}
          currentBranch={null}
          project={project}
          selectedThreadId={selectedThreadId}
          terminalRunningSessionPaths={terminalRunningSessionPaths}
          thread={thread}
          onAction={onAction}
          onThreadOpen={onThreadOpen}
        />
      ))}
    </div>
  )
}

function ProjectWorkBlockActions({
  activeView,
  expanded,
  hideSessionCounts,
  isProjectActive,
  olderThreadCount,
  selectedThreadId,
  onOpenProjectSessions,
  onOpenAutomations,
}: {
  activeView: View
  expanded: boolean
  hideSessionCounts: boolean
  isProjectActive: boolean
  olderThreadCount: number
  selectedThreadId: string | null
  onOpenProjectSessions: () => void
  onOpenAutomations: () => void
}) {
  return (
    <div className="sidebar-project-work-project-block-actions">
      <button
        type="button"
        className="sidebar-compact-row sidebar-compact-row--action sidebar-project-work-action-row"
        data-active={activeView === 'automations' && isProjectActive ? 'true' : 'false'}
        onClick={onOpenAutomations}
      >
        <ChevronRight size={13} aria-hidden="true" />
        <span>Automations</span>
        <span className="sidebar-project-work-pill">Soon</span>
      </button>
      {expanded ? (
        <button
          type="button"
          className="sidebar-compact-row sidebar-compact-row--action sidebar-project-work-history-row"
          data-active={
            activeView === 'sessions' && isProjectActive && selectedThreadId === null
              ? 'true'
              : 'false'
          }
          onClick={onOpenProjectSessions}
        >
          <Archive size={14} />
          <span>Past sessions</span>
          {hideSessionCounts ? null : (
            <span className={cn('sidebar-project-work-history-count', appToneSubtleClass)}>
              {olderThreadCount}
            </span>
          )}
        </button>
      ) : null}
    </div>
  )
}

export function ProjectWorkSummaryBlock({
  activeView,
  branchGroups,
  collapsedBranchIds,
  currentBranch,
  currentBranchDirty,
  expanded,
  hideSessionCounts,
  isGitRepo,
  olderThreadCount,
  project,
  searchQuery,
  selectedProjectId,
  selectedThreadId,
  terminalRunningSessionPaths,
  threads,
  unassignedCollapsed,
  onAction,
  onFocusProject,
  onPrimeProject,
  onSetCollapsedBranchIds,
  onShowView,
  onThreadOpen,
  onToggleExpanded,
  onToggleUnassigned,
}: {
  activeView: View
  branchGroups: BranchThreadGroup[]
  collapsedBranchIds: Record<string, boolean>
  currentBranch: string | null
  currentBranchDirty: boolean
  expanded: boolean
  hideSessionCounts: boolean
  isGitRepo: boolean
  olderThreadCount: number
  project: Project
  searchQuery: string
  selectedProjectId: string
  selectedThreadId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  threads: Thread[]
  unassignedCollapsed: boolean
  onAction: DesktopActionInvoker
  onFocusProject: (projectId: string) => void
  onPrimeProject: (projectId: string) => void
  onSetCollapsedBranchIds: (
    updater: (current: Record<string, boolean>) => Record<string, boolean>,
  ) => void
  onShowView: (view: Exclude<View, 'gitops'>) => void
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
  onToggleExpanded: () => void
  onToggleUnassigned: () => void
}) {
  const isProjectActive = selectedProjectId === project.id
  const openProjectSessions = () => {
    onPrimeProject(project.id)
    onShowView('sessions')
    void onAction('project.select', { projectId: project.id })
  }
  const openProjectAutomations = () => {
    onFocusProject(project.id)
    onShowView('automations')
  }
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const branchThreads = filterThreadsBySearch(
    filterThreadsForCurrentBranch(threads, currentBranch),
    searchQuery,
  )
  const unassignedThreads = filterThreadsBySearch(
    sortThreads(threads.filter((thread) => !thread.branchName?.trim())),
    searchQuery,
  )
  const filteredBranchGroups = filterBranchGroups(branchGroups, searchQuery)
  const compactWorktreeGroups = filteredBranchGroups.filter(
    (group) =>
      (group.worktree || group.worktrees.length > 0) &&
      !group.current &&
      branchGroupBelongsToBranch(group, currentBranch),
  )
  const searchExpanded = normalizedSearchQuery.length > 0
  const unassignedExpanded = searchExpanded || !unassignedCollapsed

  if (
    !projectBlockMatchesSearch({
      branchGroups: filteredBranchGroups,
      normalizedSearchQuery,
      projectName: project.name,
    })
  )
    return null

  return (
    <section className="sidebar-project-work-project-block">
      <ProjectWorkBlockHeader
        currentBranch={currentBranch}
        expanded={expanded}
        isGitRepo={isGitRepo}
        project={project}
        onAction={onAction}
        onFocusProject={onFocusProject}
        onToggleExpanded={onToggleExpanded}
      />

      <ProjectWorkBlockActions
        activeView={activeView}
        expanded={expanded}
        hideSessionCounts={hideSessionCounts}
        isProjectActive={isProjectActive}
        olderThreadCount={olderThreadCount}
        selectedThreadId={selectedThreadId}
        onOpenAutomations={openProjectAutomations}
        onOpenProjectSessions={openProjectSessions}
      />

      {isGitRepo ? (
        expanded || searchExpanded ? (
          <ProjectExpandedBranchGroups
            activeView={activeView}
            branchGroups={filteredBranchGroups}
            collapsedBranchIds={collapsedBranchIds}
            currentBranch={currentBranch}
            currentBranchDirty={currentBranchDirty}
            hideSessionCounts={hideSessionCounts}
            normalizedSearchQuery={normalizedSearchQuery}
            project={project}
            selectedThreadId={selectedThreadId}
            terminalRunningSessionPaths={terminalRunningSessionPaths}
            onAction={onAction}
            onSetCollapsedBranchIds={onSetCollapsedBranchIds}
            onThreadOpen={onThreadOpen}
          />
        ) : (
          <ProjectCompactBranchGroups
            activeView={activeView}
            branchThreads={branchThreads}
            collapsedBranchIds={collapsedBranchIds}
            currentBranch={currentBranch}
            currentBranchDirty={currentBranchDirty}
            currentBranchExpanded={
              normalizedSearchQuery.length > 0 ||
              !(collapsedBranchIds[`${project.id}:current-branch`] ?? false)
            }
            hideSessionCounts={hideSessionCounts}
            normalizedSearchQuery={normalizedSearchQuery}
            project={project}
            selectedThreadId={selectedThreadId}
            terminalRunningSessionPaths={terminalRunningSessionPaths}
            unassignedExpanded={unassignedExpanded}
            unassignedThreads={unassignedThreads}
            worktreeGroups={compactWorktreeGroups}
            onAction={onAction}
            onSetCollapsedBranchIds={onSetCollapsedBranchIds}
            onThreadOpen={onThreadOpen}
            onToggleCurrentBranch={() =>
              onSetCollapsedBranchIds((current) => ({
                ...current,
                [`${project.id}:current-branch`]: !(
                  current[`${project.id}:current-branch`] ?? false
                ),
              }))
            }
            onToggleUnassigned={onToggleUnassigned}
          />
        )
      ) : (
        <NonGitProjectBlockThreads
          activeView={activeView}
          project={project}
          searchQuery={searchQuery}
          selectedThreadId={selectedThreadId}
          terminalRunningSessionPaths={terminalRunningSessionPaths}
          threads={expanded || searchExpanded ? threads : sortThreads(threads).slice(0, 5)}
          onAction={onAction}
          onThreadOpen={onThreadOpen}
        />
      )}
    </section>
  )
}
