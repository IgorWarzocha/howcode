import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { useQueries } from '@tanstack/react-query'
import { FolderCode } from 'lucide-react'
import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useHowcodeKeybindingCommand } from '../../../app-shell/keybinding-events'
import type { AppSettings, DesktopActionInvoker, ProjectGitState } from '../../../desktop/types'
import { desktopQueryKeys, getProjectGitStateQuery } from '../../../query/desktop-query'
import type { Project, View } from '../../../types'
import { SidebarProjectsSkeleton } from '../sidebar-skeletons'
import { ProjectInstallTargetList } from './project-install-target-list'
import { ProjectScopeSelector } from './project-scope-selector'
import { MultiProjectWorkContent, SingleProjectWorkContent } from './project-work-content'
import {
  buildBranchGroups,
  filterBranchGroups,
  getCurrentBranchForProject,
  getDisplayableProjects,
  getDisplayableWorkspaces,
  getProjectGitStateForSidebar,
  getProjectScopeLabel,
  getRepositoryBranchesForProject,
  getThreadBucketsForProjectWork,
  getVisibleProjectIds,
  getWorktreeBranchesForProject,
  getWorktreeProjectsForRoot,
  hasUncommittedProjectChanges,
  orderProjectsForScopeSelector,
  UNASSIGNED_BRANCH_GROUP_ID,
} from './project-work-model'

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

function filterVisibleProjectIds(
  configuredProjectIds: string[] | null | undefined,
  projects: Project[],
) {
  if (!configuredProjectIds) return configuredProjectIds
  const validProjectIds = new Set(projects.map((project) => project.id))
  return configuredProjectIds.filter((projectId) => validProjectIds.has(projectId))
}

function useInitialEmptyProjectScope({
  initialVisibleProjectIds,
  onShowView,
  projectTargetMode,
}: Pick<ProjectWorkSectionProps, 'initialVisibleProjectIds' | 'onShowView' | 'projectTargetMode'>) {
  const appliedRef = useRef(false)
  useEffect(() => {
    if (appliedRef.current || initialVisibleProjectIds === undefined) return
    appliedRef.current = true
    if (projectTargetMode) return
    if (initialVisibleProjectIds === null || initialVisibleProjectIds.length > 0) return
    onShowView('landing')
  }, [initialVisibleProjectIds, onShowView, projectTargetMode])
}

function applyVisibleProjectToggle(input: {
  projectId: string
  visibleProjectIds: string[]
  setVisibleProjectIds: (projectIds: string[]) => void
  focusProject: (projectId: string) => void
  showLanding: () => void
}) {
  const wasVisible = input.visibleProjectIds.includes(input.projectId)
  const nextProjectIds = wasVisible
    ? input.visibleProjectIds.filter((id) => id !== input.projectId)
    : [...input.visibleProjectIds, input.projectId]
  input.setVisibleProjectIds(nextProjectIds)
  if (!wasVisible && input.visibleProjectIds.length === 0) {
    input.focusProject(input.projectId)
  } else if (nextProjectIds.length === 0) {
    input.showLanding()
  }
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
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedBranchIds, setCollapsedBranchIds] = useState<Record<string, boolean>>({})
  const [pruneConfirmBranchId, setPruneConfirmBranchId] = useState<string | null>(null)
  const [switchErrorBranchId, setSwitchErrorBranchId] = useState<string | null>(null)
  const [visibleProjectIdsOverride, setStoredVisibleProjectIds] = useState<
    string[] | null | undefined
  >(undefined)
  const [scopeSelectorOrderIds, setScopeSelectorOrderIds] = useState<string[] | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const displayableWorkspaces = useMemo(() => getDisplayableWorkspaces(projects), [projects])
  const displayableProjects = useMemo(() => getDisplayableProjects(projects), [projects])
  const selectedWorkspace = displayableWorkspaces.find(
    (project) => project.id === selectedProjectId,
  )
  const selectedProject =
    displayableProjects.find((project) => project.id === selectedProjectId) ??
    displayableProjects.find(
      (project) => project.id === selectedWorkspace?.worktree?.rootProjectId,
    ) ??
    displayableProjects[0] ??
    null
  const configuredVisibleProjectIds =
    visibleProjectIdsOverride === undefined ? initialVisibleProjectIds : visibleProjectIdsOverride
  const storedVisibleProjectIds = useMemo(() => {
    return filterVisibleProjectIds(configuredVisibleProjectIds, displayableProjects)
  }, [configuredVisibleProjectIds, displayableProjects])
  const visibleProjectIds = getVisibleProjectIds(
    storedVisibleProjectIds ?? null,
    null,
    selectedProject,
  )
  useInitialEmptyProjectScope({ initialVisibleProjectIds, onShowView, projectTargetMode })

  const visibleProjects = useMemo(() => {
    const visibleIds = new Set(visibleProjectIds)
    return displayableProjects.filter((project) => visibleIds.has(project.id))
  }, [displayableProjects, visibleProjectIds])

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
  const scopeSelectorProjects = useMemo(
    () =>
      orderProjectsForScopeSelector(
        displayableProjects,
        projectSwitcherOpen && scopeSelectorOrderIds ? scopeSelectorOrderIds : visibleProjectIds,
      ),
    [displayableProjects, projectSwitcherOpen, scopeSelectorOrderIds, visibleProjectIds],
  )

  const gitStateQueries = useQueries({
    queries: visibleProjects.map((project) => ({
      queryKey: desktopQueryKeys.projectGitState(project.id),
      queryFn: () => getProjectGitStateQuery(project.id),
      staleTime: 0,
    })),
  })
  const gitStatesByProjectId = useMemo(() => {
    const states = new Map<string, ProjectGitState | null>()
    for (const [index, project] of visibleProjects.entries()) {
      states.set(project.id, gitStateQueries[index]?.data ?? null)
    }
    if (projectGitState) states.set(projectGitState.projectId, projectGitState)
    return states
  }, [gitStateQueries, projectGitState, visibleProjects])
  const loadProjectThreads = useEffectEvent(onLoadProjectThreads)

  useEffect(() => {
    const projectsToLoad = new Map(visibleProjects.map((project) => [project.id, project]))
    for (const project of visibleProjects) {
      for (const worktreeProject of getWorktreeProjectsForRoot(project, displayableWorkspaces)) {
        projectsToLoad.set(worktreeProject.id, worktreeProject)
      }
    }
    for (const project of projectsToLoad.values()) {
      if (project.threadsLoaded) continue
      void loadProjectThreads(project.id, { chat: false })
    }
  }, [displayableWorkspaces, visibleProjects])

  const focusProject = (projectId: string) => {
    onProjectSelect(projectId)
    void onAction('project.select', { projectId })
  }
  const primeProject = (projectId: string) => {
    onProjectPrimeSelection(projectId)
    void onAction('project.select', { projectId })
  }
  const toggleVisibleProject = (projectId: string) => {
    applyVisibleProjectToggle({
      projectId,
      visibleProjectIds,
      setVisibleProjectIds: setStoredVisibleProjectIds,
      focusProject,
      showLanding: () => onShowView('landing'),
    })
  }

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
  const scopeProject =
    visibleProjects.find((project) => project.id === selectedProject.id) ??
    visibleProjects[0] ??
    null
  const projectScopeLabel = getProjectScopeLabel({ selectedProject, visibleProjects })

  const setProjectSwitcherOpenState = (open: boolean) => {
    if (open) setScopeSelectorOrderIds(visibleProjectIds)
    setProjectSwitcherOpen(open)
    if (open || storedVisibleProjectIds === null) return
    setScopeSelectorOrderIds(null)
    void onAction('workspace.sidebar-scope', { projectIds: storedVisibleProjectIds })
  }
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
        onOpenChange={setProjectSwitcherOpenState}
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
          onSetPruneConfirmBranchId={setPruneConfirmBranchId}
          onSetSwitchErrorBranchId={setSwitchErrorBranchId}
          pruneConfirmBranchId={pruneConfirmBranchId}
          switchErrorBranchId={switchErrorBranchId}
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
          pruneConfirmBranchId={pruneConfirmBranchId}
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          selectedGroupId={selectedGroupId}
          selectedThreadId={selectedThreadId}
          switchErrorBranchId={switchErrorBranchId}
          terminalRunningSessionPaths={terminalRunningSessionPaths}
          onAction={onAction}
          onFocusProject={focusProject}
          onSearchQueryChange={setSearchQuery}
          onSetCollapsedBranchIds={setCollapsedBranchIds}
          onSetPruneConfirmBranchId={setPruneConfirmBranchId}
          onSetSwitchErrorBranchId={setSwitchErrorBranchId}
          onShowView={onShowView}
          onThreadOpen={onThreadOpen}
        />
      )}
    </section>
  )
}
