import { IconButton } from '@howcode/common/icon-button'
import { Archive, ChevronRight, Home, MoreHorizontal } from 'lucide-react'
import { type RefObject, useLayoutEffect, useRef, useState } from 'react'
import type { DesktopActionInvoker, ProjectGitState } from '../../../desktop/types'
import { useDismissibleLayer } from '../../../hooks/useDismissibleLayer'
import type { Project, View } from '../../../types'
import { appToneSubtleClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { shouldSeparateBranchGroups } from './branch-group-layout'
import { BranchThreadGroupSection } from './branch-thread-groups'
import { NewThreadMenu } from './new-thread-menu'
import { ProjectWorkActionsMenu } from './project-work-actions-menu'
import { ProjectWorkSummaryBlock } from './project-work-block'
import { SearchHistoryField } from './project-work-fields'
import {
  type BranchThreadGroup,
  buildBranchGroups,
  getCurrentBranchForProject,
  getRepositoryBranchesForProject,
  getThreadBucketsForProjectWork,
  getWorktreeBranchesForProject,
  hasUncommittedProjectChanges,
  UNASSIGNED_BRANCH_GROUP_ID,
} from './project-work-model'
import { ProjectWorkThreadRow } from './project-work-thread-row'

function ProjectActionsMenuButton({
  project,
  onAction,
}: {
  project: Project
  onAction: DesktopActionInvoker
}) {
  const [open, setOpen] = useState(false)
  const [menuWidth, setMenuWidth] = useState(240)
  const [menuRight, setMenuRight] = useState(0)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  useDismissibleLayer({
    open,
    onDismiss: () => setOpen(false),
    refs: [buttonRef, menuRef],
  })
  useLayoutEffect(() => {
    if (!(open && buttonRef.current)) return
    const anchor = buttonRef.current
    const row = anchor.closest(
      '.sidebar-project-work-toolbar, .sidebar-project-work-section-heading',
    )
    const rowRect = row?.getBoundingClientRect()
    const anchorRect = anchor.getBoundingClientRect()
    if (!rowRect) {
      setMenuWidth(anchor.offsetLeft + anchor.offsetWidth)
      setMenuRight(0)
      return
    }
    setMenuWidth(rowRect.width)
    setMenuRight(anchorRect.right - rowRect.right)
  }, [open])

  return (
    <div className="sidebar-project-work-project-menu-anchor">
      <IconButton
        ref={buttonRef}
        label="Project actions"
        icon={<MoreHorizontal size={13} />}
        tooltipPlacement="right"
        className="sidebar-project-work-project-menu-button h-7 w-7 rounded-md"
        onClick={() => setOpen((current) => !current)}
      />
      {open ? (
        <ProjectWorkActionsMenu
          ref={menuRef}
          right={menuRight}
          width={menuWidth}
          project={project}
          onAction={onAction}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  )
}

function ProjectDashboardButton({
  active,
  project,
  onOpenDashboard,
}: {
  active: boolean
  project: Project
  onOpenDashboard: () => void
}) {
  return (
    <IconButton
      label={`Open ${project.name} dashboard`}
      icon={<Home size={13} />}
      active={active}
      tooltip="Project dashboard"
      tooltipPlacement="right"
      className="sidebar-project-work-project-menu-button h-7 w-7 rounded-md"
      onClick={onOpenDashboard}
    />
  )
}

function NonGitProjectThreads({
  activeView,
  branchGroups,
  project,
  selectedThreadId,
  terminalRunningSessionPaths,
  onAction,
  onThreadOpen,
}: {
  activeView: View
  branchGroups: BranchThreadGroup[]
  project: Project
  selectedThreadId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  onAction: DesktopActionInvoker
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
}) {
  const threads = branchGroups.flatMap((group) => group.threads)
  return (
    <div className="sidebar-project-work-thread-list">
      {threads.map((thread) => (
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

export function MultiProjectWorkContent({
  activeView,
  allProjects,
  collapsedBranchIds,
  collapsedProjectIds,
  gitStatesByProjectId,
  projectGitState,
  searchInputRef,
  searchQuery,
  selectedProjectId,
  selectedThreadId,
  hideSessionCounts,
  terminalRunningSessionPaths,
  visibleProjects,
  onAction,
  onFocusProject,
  onPrimeProject,
  onSearchQueryChange,
  onSetCollapsedBranchIds,
  onToggleProjectCollapse,
  onShowView,
  onThreadOpen,
}: {
  activeView: View
  allProjects: Project[]
  collapsedBranchIds: Record<string, boolean>
  collapsedProjectIds: Record<string, boolean>
  gitStatesByProjectId: ReadonlyMap<string, ProjectGitState | null>
  projectGitState: ProjectGitState | null
  searchInputRef: RefObject<HTMLInputElement | null>
  searchQuery: string
  selectedProjectId: string
  selectedThreadId: string | null
  hideSessionCounts: boolean
  terminalRunningSessionPaths: ReadonlySet<string>
  visibleProjects: Project[]
  onAction: DesktopActionInvoker
  onFocusProject: (projectId: string) => void
  onPrimeProject: (projectId: string) => void
  onSearchQueryChange: (query: string) => void
  onSetCollapsedBranchIds: (
    updater: (current: Record<string, boolean>) => Record<string, boolean>,
  ) => void
  onToggleProjectCollapse: (projectId: string) => void
  onShowView: (view: Exclude<View, 'gitops'>) => void
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
}) {
  return (
    <div className="sidebar-project-work-lane">
      <div className="sidebar-project-work-section-heading sidebar-project-work-section-heading--search-only">
        <SearchHistoryField
          inputRef={searchInputRef}
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
        />
      </div>
      <div className="sidebar-project-work-scroll-shell">
        <div className="sidebar-project-work-thread-list sidebar-project-work-project-block-list">
          {visibleProjects.map((project) => {
            const buckets = getThreadBucketsForProjectWork(project, allProjects, selectedThreadId)
            const blockCurrentBranch = getCurrentBranchForProject(
              project,
              projectGitState,
              gitStatesByProjectId,
            )
            const repositoryBranches = getRepositoryBranchesForProject(
              project,
              projectGitState,
              gitStatesByProjectId,
            )
            const worktreeBranches = getWorktreeBranchesForProject(
              project,
              allProjects,
              projectGitState,
              gitStatesByProjectId,
            )
            const branchGroups = buildBranchGroups(
              buckets.activeThreads,
              blockCurrentBranch,
              repositoryBranches,
              worktreeBranches,
            )
            const blockGitState = gitStatesByProjectId.get(project.id) ?? null
            const blockIsGitRepo = Boolean(blockGitState?.isGitRepo)
            const blockCurrentBranchDirty = hasUncommittedProjectChanges(blockGitState)
            const unassignedGroupId = `${project.id}:${UNASSIGNED_BRANCH_GROUP_ID}`
            const expanded = !(collapsedProjectIds[project.id] ?? project.collapsed ?? true)
            return (
              <ProjectWorkSummaryBlock
                key={project.id}
                activeView={activeView}
                branchGroups={branchGroups}
                collapsedBranchIds={collapsedBranchIds}
                currentBranch={blockCurrentBranch}
                currentBranchDirty={blockCurrentBranchDirty}
                expanded={expanded}
                hideSessionCounts={hideSessionCounts}
                isGitRepo={blockIsGitRepo}
                olderThreadCount={buckets.olderThreads.length}
                project={project}
                searchQuery={searchQuery}
                selectedProjectId={selectedProjectId}
                selectedThreadId={selectedThreadId}
                terminalRunningSessionPaths={terminalRunningSessionPaths}
                threads={buckets.activeThreads}
                unassignedCollapsed={collapsedBranchIds[unassignedGroupId] ?? true}
                onAction={onAction}
                onFocusProject={onFocusProject}
                onPrimeProject={onPrimeProject}
                onSetCollapsedBranchIds={onSetCollapsedBranchIds}
                onShowView={onShowView}
                onThreadOpen={onThreadOpen}
                onToggleExpanded={() => onToggleProjectCollapse(project.id)}
                onToggleUnassigned={() =>
                  onSetCollapsedBranchIds((current) => ({
                    ...current,
                    [unassignedGroupId]: !(current[unassignedGroupId] ?? true),
                  }))
                }
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function SingleProjectWorkContent({
  activeView,
  branchGroups,
  collapsedBranchIds,
  currentBranch,
  currentBranchDirty,
  hideSessionCounts,
  isGitRepo,
  olderThreadCount,
  normalizedSearchQuery,
  project,
  searchInputRef,
  searchQuery,
  selectedGroupId,
  selectedThreadId,
  terminalRunningSessionPaths,
  onAction,
  onFocusProject,
  onSearchQueryChange,
  onSetCollapsedBranchIds,
  onShowView,
  onThreadOpen,
}: {
  activeView: View
  branchGroups: BranchThreadGroup[]
  collapsedBranchIds: Record<string, boolean>
  currentBranch: string | null
  currentBranchDirty: boolean
  hideSessionCounts: boolean
  isGitRepo: boolean
  olderThreadCount: number
  normalizedSearchQuery: string
  project: Project
  searchInputRef: RefObject<HTMLInputElement | null>
  searchQuery: string
  selectedGroupId: string
  selectedThreadId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  onAction: DesktopActionInvoker
  onFocusProject: (projectId: string) => void
  onSearchQueryChange: (query: string) => void
  onSetCollapsedBranchIds: (
    updater: (current: Record<string, boolean>) => Record<string, boolean>,
  ) => void
  onShowView: (view: Exclude<View, 'gitops'>) => void
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
}) {
  const openProjectView = (view: Exclude<View, 'gitops'>) => {
    onFocusProject(project.id)
    onShowView(view)
  }
  const openProjectDashboard = () => openProjectView('project')

  return (
    <>
      <div className="sidebar-project-work-toolbar">
        <ProjectDashboardButton
          active={activeView === 'project'}
          project={project}
          onOpenDashboard={openProjectDashboard}
        />
        <div className="sidebar-project-work-toolbar-actions">
          <ProjectActionsMenuButton project={project} onAction={onAction} />
          <NewThreadMenu
            currentBranch={currentBranch}
            isGitRepo={isGitRepo}
            onAction={onAction}
            projectId={project.id}
          />
        </div>
      </div>

      <div className="sidebar-project-work-actions">
        <button
          type="button"
          className="sidebar-compact-row sidebar-compact-row--action sidebar-project-work-action-row"
          data-active={activeView === 'automations' ? 'true' : 'false'}
          onClick={() => openProjectView('automations')}
        >
          <ChevronRight size={13} aria-hidden="true" />
          <span>Automations</span>
          <span className="sidebar-project-work-pill">Soon</span>
        </button>
        <button
          type="button"
          className="sidebar-compact-row sidebar-compact-row--action sidebar-project-work-history-row"
          data-active={activeView === 'sessions' && selectedThreadId === null ? 'true' : 'false'}
          onClick={() => openProjectView('sessions')}
        >
          <Archive size={14} />
          <span>Past sessions</span>
          {hideSessionCounts ? null : (
            <span className={cn('sidebar-project-work-history-count', appToneSubtleClass)}>
              {olderThreadCount}
            </span>
          )}
        </button>
      </div>

      <div className="sidebar-project-work-lane">
        <div className="sidebar-project-work-section-heading sidebar-project-work-section-heading--search-only">
          <SearchHistoryField
            inputRef={searchInputRef}
            searchQuery={searchQuery}
            onSearchQueryChange={onSearchQueryChange}
          />
        </div>

        <div className="sidebar-project-work-scroll-shell">
          {isGitRepo ? (
            <div className="sidebar-project-work-thread-list">
              {branchGroups.map((group, index) => {
                const groupKey = `${project.id}:${group.id}`
                const defaultCollapsed = !(
                  group.current ||
                  group.id === selectedGroupId ||
                  group.worktrees.length > 0
                )
                const collapsed = normalizedSearchQuery
                  ? false
                  : (collapsedBranchIds[groupKey] ?? defaultCollapsed)
                const showBottomDivider =
                  !collapsed && shouldSeparateBranchGroups(group, branchGroups[index + 1])
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
                  />
                )
              })}
            </div>
          ) : (
            <NonGitProjectThreads
              activeView={activeView}
              branchGroups={branchGroups}
              project={project}
              selectedThreadId={selectedThreadId}
              terminalRunningSessionPaths={terminalRunningSessionPaths}
              onAction={onAction}
              onThreadOpen={onThreadOpen}
            />
          )}
        </div>
      </div>
    </>
  )
}
