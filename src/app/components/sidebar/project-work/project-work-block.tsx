import { GitHubInvertocatMark } from '@howcode/common/github-invertocat-mark'
import { IconButton } from '@howcode/common/icon-button'
import { Archive, ChevronRight, FolderCode, MoreHorizontal } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import { useDismissibleLayer } from '../../../hooks/useDismissibleLayer'
import type { Project, Thread, View } from '../../../types'
import { appToneSubtleClass, appTypeMetaClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { ProjectExpandedBranchGroups } from './branch-thread-groups'
import { ProjectCompactBranchGroups } from './compact-branch-groups'
import { NewThreadMenu } from './new-thread-menu'
import { ProjectWorkActionsMenu } from './project-work-actions-menu'
import { ProjectRenameField } from './project-work-fields'
import {
  type BranchThreadGroup,
  branchGroupBelongsToBranch,
  filterBranchGroups,
  filterThreadsBySearch,
  filterThreadsForCurrentBranch,
  projectBlockMatchesSearch,
  sortThreads,
} from './project-work-model'
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
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const [renameDraft, setRenameDraft] = useState(project.name)
  const [editingName, setEditingName] = useState(false)
  const [menuWidth, setMenuWidth] = useState(240)
  const [menuRight, setMenuRight] = useState(0)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  useDismissibleLayer({
    open: projectMenuOpen,
    onDismiss: () => setProjectMenuOpen(false),
    refs: [menuButtonRef, menuRef],
  })
  useEffect(() => {
    if (!editingName) setRenameDraft(project.name)
  }, [editingName, project.name])
  useLayoutEffect(() => {
    if (!(projectMenuOpen && menuButtonRef.current)) return
    const anchor = menuButtonRef.current
    const row = anchor.closest('.sidebar-project-work-project-block-heading-row')
    const rowRect = row?.getBoundingClientRect()
    const anchorRect = anchor.getBoundingClientRect()
    if (!rowRect) {
      setMenuWidth(anchor.offsetLeft + anchor.offsetWidth)
      setMenuRight(0)
      return
    }
    setMenuWidth(rowRect.width)
    setMenuRight(anchorRect.right - rowRect.right)
  }, [projectMenuOpen])
  const submitRename = () => {
    const nextName = renameDraft.trim()
    setEditingName(false)
    if (!nextName || nextName === project.name) {
      setRenameDraft(project.name)
      return
    }
    void onAction('project.edit-name', { projectId: project.id, projectName: nextName })
  }

  return (
    <div className="sidebar-project-work-project-block-heading-row">
      <button
        type="button"
        className="sidebar-icon-action sidebar-icon-action--md sidebar-icon-action--no-hover sidebar-project-work-project-block-disclosure"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
        aria-label={expanded ? `Collapse ${project.name}` : `Expand ${project.name}`}
      >
        {project.repoOriginUrl ? (
          <GitHubInvertocatMark size={13} className="sidebar-project-work-project-origin-icon" />
        ) : (
          <FolderCode size={13} />
        )}
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
          onClick={() => onFocusProject(project.id)}
        >
          <span className="truncate">{project.name}</span>
        </button>
      )}
      <div className="sidebar-project-work-project-menu-anchor">
        <IconButton
          ref={menuButtonRef}
          label="Project actions"
          icon={<MoreHorizontal size={13} />}
          tooltipPlacement="right"
          className="sidebar-project-work-project-menu-button h-7 w-7 rounded-md"
          onClick={() => setProjectMenuOpen((current) => !current)}
        />
        {projectMenuOpen ? (
          <ProjectWorkActionsMenu
            ref={menuRef}
            right={menuRight}
            width={menuWidth}
            project={project}
            onAction={onAction}
            onClose={() => setProjectMenuOpen(false)}
            onRename={() => {
              setProjectMenuOpen(false)
              setEditingName(true)
            }}
          />
        ) : null}
      </div>
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
            <span className={cn(appTypeMetaClass, appToneSubtleClass)}>{olderThreadCount}</span>
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
  pruneConfirmBranchId,
  searchQuery,
  selectedProjectId,
  selectedThreadId,
  switchErrorBranchId,
  terminalRunningSessionPaths,
  threads,
  unassignedCollapsed,
  onAction,
  onFocusProject,
  onPrimeProject,
  onSetCollapsedBranchIds,
  onSetPruneConfirmBranchId,
  onSetSwitchErrorBranchId,
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
  pruneConfirmBranchId: string | null
  searchQuery: string
  selectedProjectId: string
  selectedThreadId: string | null
  switchErrorBranchId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  threads: Thread[]
  unassignedCollapsed: boolean
  onAction: DesktopActionInvoker
  onFocusProject: (projectId: string) => void
  onPrimeProject: (projectId: string) => void
  onSetCollapsedBranchIds: (
    updater: (current: Record<string, boolean>) => Record<string, boolean>,
  ) => void
  onSetPruneConfirmBranchId: (branchId: string | null) => void
  onSetSwitchErrorBranchId: (branchId: string | null) => void
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
            pruneConfirmBranchId={pruneConfirmBranchId}
            selectedThreadId={selectedThreadId}
            switchErrorBranchId={switchErrorBranchId}
            terminalRunningSessionPaths={terminalRunningSessionPaths}
            onAction={onAction}
            onSetCollapsedBranchIds={onSetCollapsedBranchIds}
            onSetPruneConfirmBranchId={onSetPruneConfirmBranchId}
            onSetSwitchErrorBranchId={onSetSwitchErrorBranchId}
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
            pruneConfirmBranchId={pruneConfirmBranchId}
            selectedThreadId={selectedThreadId}
            switchErrorBranchId={switchErrorBranchId}
            terminalRunningSessionPaths={terminalRunningSessionPaths}
            unassignedExpanded={unassignedExpanded}
            unassignedThreads={unassignedThreads}
            worktreeGroups={compactWorktreeGroups}
            onAction={onAction}
            onSetCollapsedBranchIds={onSetCollapsedBranchIds}
            onSetPruneConfirmBranchId={onSetPruneConfirmBranchId}
            onSetSwitchErrorBranchId={onSetSwitchErrorBranchId}
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
          threads={threads}
          onAction={onAction}
          onThreadOpen={onThreadOpen}
        />
      )}
    </section>
  )
}
