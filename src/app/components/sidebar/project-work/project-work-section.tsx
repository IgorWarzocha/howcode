import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { FolderCode } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { useHowcodeKeybindingCommand } from '../../../app-shell/keybinding-events'
import type { AppSettings, DesktopActionInvoker, ProjectGitState } from '../../../desktop/types'
import type { Project, View } from '../../../types'
import { SidebarProjectsSkeleton } from '../sidebar-skeletons'
import {
  buildBranchGroups,
  filterBranchGroups,
  UNASSIGNED_BRANCH_GROUP_ID,
} from './branch-group-model'
import {
  getCurrentBranchForProject,
  getProjectGitStateForSidebar,
  getRepositoryBranchesForProject,
  getWorktreeBranchesForProject,
  hasUncommittedProjectChanges,
} from './project-git-model'
import { ProjectInstallTargetList } from './project-install-target-list'
import { ProjectScopeSelector } from './project-scope-selector'
import { getThreadBucketsForProjectWork } from './project-thread-model'
import { MultiProjectWorkContent, SingleProjectWorkContent } from './project-work-content'
import { useProjectGitStates } from './useProjectGitStates'
import { useProjectScopeController } from './useProjectScopeController'
import { useProjectThreadLoading } from './useProjectThreadLoading'

type ProjectWorkSectionProps = {
  activeView: View
  loading: boolean
  projects: Project[]
  projectGitState: ProjectGitState | null
  collapsedProjectIds: Record<string, boolean>
  initialVisibleProjectIds: string[] | null | undefined
  selectedProjectId: string
  selectedThreadId: string | null
  projectTargetMode?: boolean | undefined
  projectScopeLockActive?: boolean | undefined
  terminalRunningWorkspaceIds: ReadonlySet<string>
  terminalRunningSessionPaths: ReadonlySet<string>
  onAction: DesktopActionInvoker
  onLoadProjectThreads: (projectId: string, options?: { chat?: boolean }) => Promise<unknown>
  appSettings: AppSettings
  onOpenSettingsPanel: (target?: SettingsOpenTarget) => void
  onProjectSelect: (projectId: string) => void
  onProjectPrimeSelection: (projectId: string) => void
  onProjectTargetSelected?: (() => void) | undefined
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
  onShowView: (view: Exclude<View, 'gitops'>) => void
  onToggleProjectCollapse: (projectId: string) => void
}

export function ProjectWorkSection({
  activeView,
  appSettings,
  loading,
  projects,
  projectGitState,
  collapsedProjectIds,
  projectTargetMode = false,
  initialVisibleProjectIds,
  selectedProjectId,
  selectedThreadId,
  terminalRunningWorkspaceIds,
  terminalRunningSessionPaths,
  onAction,
  onLoadProjectThreads,
  onOpenSettingsPanel,
  onProjectSelect,
  onProjectPrimeSelection,
  onProjectTargetSelected,
  onThreadOpen,
  onShowView,
  onToggleProjectCollapse,
}: ProjectWorkSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedBranchIds, setCollapsedBranchIds] = useState<Record<string, boolean>>({})
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const scope = useProjectScopeController({
    initialVisibleProjectIds,
    projects,
    projectTargetMode,
    selectedProjectId,
    onAction,
    onProjectPrimeSelection,
    onProjectSelect,
    onShowView,
  })
  const {
    displayableProjects,
    displayableWorkspaces,
    focusProject,
    primeProject,
    projectScopeLabel,
    projectSwitcherOpen,
    scopeProject,
    scopeSelectorProjects,
    selectedProject,
    setProjectSwitcherOpen,
    toggleVisibleProject,
    visibleProjects,
  } = scope

  useHowcodeKeybindingCommand('sidebar.find', (event) => {
    event.preventDefault()
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  })

  useLayoutEffect(() => {
    if (!selectedThreadId) return
    const selectedRow = document.querySelector(
      '.sidebar-project-work-section .sidebar-thread-row[data-selected="true"]',
    )
    selectedRow?.scrollIntoView({ block: 'nearest' })
  }, [selectedThreadId])
  const gitStatesByProjectId = useProjectGitStates(visibleProjects, projectGitState)
  useProjectThreadLoading({
    allWorkspaces: displayableWorkspaces,
    visibleProjects,
    onLoadProjectThreads,
  })

  if (displayableProjects.length === 0) {
    if (loading) return <SidebarProjectsSkeleton />
    return (
      <section className="sidebar-project-work-section" aria-label="Work">
        <ProjectScopeSelector
          appSettings={appSettings}
          label="No projects yet"
          open={projectSwitcherOpen}
          projects={scopeSelectorProjects}
          scopeProject={null}
          selectedProject={null}
          terminalRunningWorkspaceIds={terminalRunningWorkspaceIds}
          visibleProjects={visibleProjects}
          onAction={onAction}
          onOpenChange={setProjectSwitcherOpen}
          onOpenSettingsPanel={onOpenSettingsPanel}
          onToggleVisibleProject={toggleVisibleProject}
        />
        <div className="sidebar-project-work-empty">
          <FolderCode size={18} />
          <span>Add a project to get started</span>
        </div>
      </section>
    )
  }

  if (projectTargetMode) {
    return (
      <section className="sidebar-project-work-section" aria-label="Project install target">
        <ProjectInstallTargetList
          projects={displayableProjects}
          selectedProjectId={selectedProjectId}
          terminalRunningWorkspaceIds={terminalRunningWorkspaceIds}
          onAction={onAction}
          onProjectPrimeSelection={onProjectPrimeSelection}
          onProjectTargetSelected={onProjectTargetSelected}
        />
      </section>
    )
  }

  if (!selectedProject) return null

  const contentProject =
    visibleProjects.length === 1 ? (visibleProjects[0] ?? selectedProject) : selectedProject

  const { activeThreads, olderThreads } = getThreadBucketsForProjectWork(
    contentProject,
    displayableWorkspaces,
    selectedThreadId,
  )
  const currentBranch = getCurrentBranchForProject(
    contentProject,
    projectGitState,
    gitStatesByProjectId,
  )
  const repositoryBranches = getRepositoryBranchesForProject(
    contentProject,
    projectGitState,
    gitStatesByProjectId,
  )
  const contentProjectGitState = getProjectGitStateForSidebar(
    contentProject.id,
    projectGitState,
    gitStatesByProjectId,
  )
  const currentBranchDirty = hasUncommittedProjectChanges(contentProjectGitState)
  const worktreeBranches = getWorktreeBranchesForProject(
    contentProject,
    displayableWorkspaces,
    projectGitState,
    gitStatesByProjectId,
  )
  const branchGroups = buildBranchGroups(
    activeThreads,
    currentBranch,
    repositoryBranches,
    worktreeBranches,
  )
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const visibleBranchGroups = filterBranchGroups(branchGroups, searchQuery)
  const selectedThread = contentProject.threads.find((thread) => thread.id === selectedThreadId)
  const selectedGroupId = selectedThread?.branchName?.trim() || UNASSIGNED_BRANCH_GROUP_ID
  const multiProjectMode = visibleProjects.length > 1
  return (
    <section className="sidebar-project-work-section" aria-label="Project work">
      <ProjectScopeSelector
        appSettings={appSettings}
        label={projectScopeLabel}
        open={projectSwitcherOpen}
        projects={scopeSelectorProjects}
        scopeProject={scopeProject}
        selectedProject={selectedProject}
        terminalRunningWorkspaceIds={terminalRunningWorkspaceIds}
        visibleProjects={visibleProjects}
        onAction={onAction}
        onOpenChange={setProjectSwitcherOpen}
        onOpenSettingsPanel={onOpenSettingsPanel}
        onToggleVisibleProject={toggleVisibleProject}
      />

      {visibleProjects.length === 0 ? (
        <div className="sidebar-project-work-empty sidebar-project-work-scope-empty">
          <FolderCode size={18} />
          <span>No projects selected.</span>
          <span>Choose projects from the selector above.</span>
        </div>
      ) : multiProjectMode ? (
        <MultiProjectWorkContent
          activeView={activeView}
          allProjects={displayableWorkspaces}
          collapsedBranchIds={collapsedBranchIds}
          collapsedProjectIds={collapsedProjectIds}
          gitStatesByProjectId={gitStatesByProjectId}
          projectGitState={projectGitState}
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          selectedProjectId={selectedProjectId}
          selectedThreadId={selectedThreadId}
          hideSessionCounts={appSettings.hideSidebarSessionCounts}
          terminalRunningSessionPaths={terminalRunningSessionPaths}
          visibleProjects={visibleProjects}
          onAction={onAction}
          onFocusProject={focusProject}
          onPrimeProject={primeProject}
          onSearchQueryChange={setSearchQuery}
          onSetCollapsedBranchIds={setCollapsedBranchIds}
          onToggleProjectCollapse={onToggleProjectCollapse}
          onShowView={onShowView}
          onThreadOpen={onThreadOpen}
        />
      ) : (
        <SingleProjectWorkContent
          activeView={activeView}
          branchGroups={visibleBranchGroups}
          collapsedBranchIds={collapsedBranchIds}
          currentBranch={currentBranch}
          currentBranchDirty={currentBranchDirty}
          hideSessionCounts={appSettings.hideSidebarSessionCounts}
          isGitRepo={Boolean(contentProjectGitState?.isGitRepo)}
          normalizedSearchQuery={normalizedSearchQuery}
          olderThreadCount={olderThreads.length}
          project={contentProject}
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          selectedGroupId={selectedGroupId}
          selectedThreadId={selectedThreadId}
          terminalRunningSessionPaths={terminalRunningSessionPaths}
          onAction={onAction}
          onFocusProject={focusProject}
          onSearchQueryChange={setSearchQuery}
          onSetCollapsedBranchIds={setCollapsedBranchIds}
          onShowView={onShowView}
          onThreadOpen={onThreadOpen}
        />
      )}
    </section>
  )
}
