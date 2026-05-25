import { IconButton } from '@howcode/common/icon-button'
import { Archive, ChevronRight, MoreHorizontal } from 'lucide-react'
import { type RefObject, useLayoutEffect, useRef, useState } from 'react'
import type { DesktopActionInvoker, ProjectGitState } from '../../../desktop/types'
import { useDismissibleLayer } from '../../../hooks/useDismissibleLayer'
import type { Project, View } from '../../../types'
import { appToneSubtleClass, appTypeMetaClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { BranchThreadGroupSection } from './branch-thread-groups'
import { NewThreadMenu } from './new-thread-menu'
import { ProjectWorkActionsMenu } from './project-work-actions-menu'
import { ProjectWorkSummaryBlock } from './project-work-block'
import { SearchHistoryField } from './project-work-fields'
import {
  type BranchThreadGroup,
  bucketThreads,
  buildBranchGroups,
  getCurrentBranchForProject,
  getRepositoryBranchesForProject,
  getThreadsForProjectWorktreeRows,
  getWorktreeBranchesForProject,
  UNASSIGNED_BRANCH_GROUP_ID,
} from './project-work-model'

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
    const row = anchor.closest('.sidebar-project-work-section-heading')
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

export function MultiProjectWorkContent({
  activeView,
  allProjects,
  collapsedBranchIds,
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
  onSetExpandedProjectIds,
  onSetPruneConfirmBranchId,
  onSetSwitchErrorBranchId,
  pruneConfirmBranchId,
  switchErrorBranchId,
  onShowView,
  onThreadOpen,
}: {
  activeView: View
  allProjects: Project[]
  collapsedBranchIds: Record<string, boolean>
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
  onSetExpandedProjectIds: (
    updater: (current: Record<string, boolean>) => Record<string, boolean>,
  ) => void
  onSetPruneConfirmBranchId: (branchId: string | null) => void
  onSetSwitchErrorBranchId: (branchId: string | null) => void
  pruneConfirmBranchId: string | null
  switchErrorBranchId: string | null
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
            const buckets = bucketThreads(project, selectedThreadId)
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
              projectGitState,
              gitStatesByProjectId,
            )
            const branchGroups = buildBranchGroups(
              [...buckets.activeThreads, ...getThreadsForProjectWorktreeRows(project, allProjects)],
              blockCurrentBranch,
              repositoryBranches,
              worktreeBranches,
            )
            const unassignedGroupId = `${project.id}:${UNASSIGNED_BRANCH_GROUP_ID}`
            const expanded = collapsedBranchIds[`project:${project.id}`] === false
            return (
              <ProjectWorkSummaryBlock
                key={project.id}
                activeView={activeView}
                branchGroups={branchGroups}
                collapsedBranchIds={collapsedBranchIds}
                currentBranch={blockCurrentBranch}
                expanded={expanded}
                hideSessionCounts={hideSessionCounts}
                olderThreadCount={buckets.olderThreads.length}
                project={project}
                pruneConfirmBranchId={pruneConfirmBranchId}
                searchQuery={searchQuery}
                selectedProjectId={selectedProjectId}
                selectedThreadId={selectedThreadId}
                switchErrorBranchId={switchErrorBranchId}
                terminalRunningSessionPaths={terminalRunningSessionPaths}
                threads={buckets.activeThreads}
                unassignedCollapsed={collapsedBranchIds[unassignedGroupId] ?? true}
                onAction={onAction}
                onFocusProject={onFocusProject}
                onPrimeProject={onPrimeProject}
                onSetCollapsedBranchIds={onSetCollapsedBranchIds}
                onSetPruneConfirmBranchId={onSetPruneConfirmBranchId}
                onSetSwitchErrorBranchId={onSetSwitchErrorBranchId}
                onShowView={onShowView}
                onThreadOpen={onThreadOpen}
                onToggleExpanded={() => {
                  onToggleProjectCollapse(project.id)
                  onSetExpandedProjectIds((current) => ({
                    ...current,
                    [`project:${project.id}`]: expanded,
                  }))
                }}
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
  hideSessionCounts,
  olderThreadCount,
  normalizedSearchQuery,
  project,
  pruneConfirmBranchId,
  searchInputRef,
  searchQuery,
  selectedGroupId,
  selectedThreadId,
  switchErrorBranchId,
  terminalRunningSessionPaths,
  onAction,
  onSearchQueryChange,
  onSetCollapsedBranchIds,
  onSetPruneConfirmBranchId,
  onSetSwitchErrorBranchId,
  onShowView,
  onThreadOpen,
}: {
  activeView: View
  branchGroups: BranchThreadGroup[]
  collapsedBranchIds: Record<string, boolean>
  currentBranch: string | null
  hideSessionCounts: boolean
  olderThreadCount: number
  normalizedSearchQuery: string
  project: Project
  pruneConfirmBranchId: string | null
  searchInputRef: RefObject<HTMLInputElement | null>
  searchQuery: string
  selectedGroupId: string
  selectedThreadId: string | null
  switchErrorBranchId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  onAction: DesktopActionInvoker
  onSearchQueryChange: (query: string) => void
  onSetCollapsedBranchIds: (
    updater: (current: Record<string, boolean>) => Record<string, boolean>,
  ) => void
  onSetPruneConfirmBranchId: (branchId: string | null) => void
  onSetSwitchErrorBranchId: (branchId: string | null) => void
  onShowView: (view: Exclude<View, 'gitops'>) => void
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
}) {
  return (
    <>
      <div className="sidebar-project-work-actions">
        <button
          type="button"
          className="sidebar-compact-row sidebar-compact-row--action sidebar-project-work-action-row"
          data-active={activeView === 'automations' ? 'true' : 'false'}
          onClick={() => onShowView('automations')}
        >
          <ChevronRight size={13} aria-hidden="true" />
          <span>Automations</span>
          <span className="sidebar-project-work-pill">Soon</span>
        </button>
        <button
          type="button"
          className="sidebar-compact-row sidebar-compact-row--action sidebar-project-work-history-row"
          data-active={activeView === 'sessions' && selectedThreadId === null ? 'true' : 'false'}
          onClick={() => onShowView('sessions')}
        >
          <Archive size={14} />
          <span>Past sessions</span>
          {hideSessionCounts ? null : (
            <span className={cn(appTypeMetaClass, appToneSubtleClass)}>{olderThreadCount}</span>
          )}
        </button>
      </div>

      <div className="sidebar-project-work-lane">
        <div className="sidebar-project-work-section-heading">
          <SearchHistoryField
            inputRef={searchInputRef}
            searchQuery={searchQuery}
            onSearchQueryChange={onSearchQueryChange}
          />
          <ProjectActionsMenuButton project={project} onAction={onAction} />
          <NewThreadMenu currentBranch={currentBranch} onAction={onAction} projectId={project.id} />
        </div>

        <div className="sidebar-project-work-scroll-shell">
          <div className="sidebar-project-work-thread-list">
            {branchGroups.map((group) => {
              const groupKey = `${project.id}:${group.id}`
              const defaultCollapsed = !(group.current || group.id === selectedGroupId)
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
          </div>
        </div>
      </div>
    </>
  )
}
