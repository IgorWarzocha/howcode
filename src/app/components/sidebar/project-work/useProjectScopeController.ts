import { useEffect, useMemo, useRef, useState } from 'react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import type { Project, View } from '../../../types'
import {
  filterVisibleProjectIds,
  getDisplayableProjects,
  getDisplayableWorkspaces,
  getProjectScopeLabel,
  getSelectedProjectForScope,
  getVisibleProjectIds,
  orderProjectsForScopeSelector,
  toggleVisibleProjectId,
} from './project-scope-model'

export function useProjectScopeController({
  initialVisibleProjectIds,
  projects,
  projectTargetMode,
  selectedProjectId,
  onAction,
  onProjectPrimeSelection,
  onProjectSelect,
  onShowView,
}: {
  initialVisibleProjectIds: string[] | null | undefined
  projects: Project[]
  projectTargetMode: boolean
  selectedProjectId: string
  onAction: DesktopActionInvoker
  onProjectPrimeSelection: (projectId: string) => void
  onProjectSelect: (projectId: string) => void
  onShowView: (view: Exclude<View, 'gitops'>) => void
}) {
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false)
  const [visibleProjectIdsOverride, setVisibleProjectIdsOverride] = useState<
    string[] | null | undefined
  >(undefined)
  const [scopeSelectorOrderIds, setScopeSelectorOrderIds] = useState<string[] | null>(null)
  const appliedInitialEmptyScopeRef = useRef(false)
  const displayableWorkspaces = useMemo(() => getDisplayableWorkspaces(projects), [projects])
  const displayableProjects = useMemo(() => getDisplayableProjects(projects), [projects])
  const selectedProject = getSelectedProjectForScope({
    projects: displayableProjects,
    selectedProjectId,
    workspaces: displayableWorkspaces,
  })
  const configuredVisibleProjectIds =
    visibleProjectIdsOverride === undefined ? initialVisibleProjectIds : visibleProjectIdsOverride
  const storedVisibleProjectIds = useMemo(
    () => filterVisibleProjectIds(configuredVisibleProjectIds, displayableProjects),
    [configuredVisibleProjectIds, displayableProjects],
  )
  const visibleProjectIds = getVisibleProjectIds(
    storedVisibleProjectIds ?? null,
    null,
    selectedProject,
  )
  const visibleProjects = useMemo(() => {
    const visibleIds = new Set(visibleProjectIds)
    return displayableProjects.filter((project) => visibleIds.has(project.id))
  }, [displayableProjects, visibleProjectIds])
  const scopeSelectorProjects = useMemo(
    () =>
      orderProjectsForScopeSelector(
        displayableProjects,
        projectSwitcherOpen && scopeSelectorOrderIds ? scopeSelectorOrderIds : visibleProjectIds,
      ),
    [displayableProjects, projectSwitcherOpen, scopeSelectorOrderIds, visibleProjectIds],
  )
  const scopeProject =
    visibleProjects.find((project) => project.id === selectedProject?.id) ??
    visibleProjects[0] ??
    null
  const projectScopeLabel = getProjectScopeLabel({ selectedProject, visibleProjects })

  useEffect(() => {
    if (appliedInitialEmptyScopeRef.current || initialVisibleProjectIds === undefined) return
    appliedInitialEmptyScopeRef.current = true
    if (projectTargetMode) return
    if (initialVisibleProjectIds === null || initialVisibleProjectIds.length > 0) return
    onShowView('landing')
  }, [initialVisibleProjectIds, onShowView, projectTargetMode])

  const focusProject = (projectId: string) => {
    onProjectSelect(projectId)
    void onAction('project.select', { projectId })
  }
  const primeProject = (projectId: string) => {
    onProjectPrimeSelection(projectId)
    void onAction('project.select', { projectId })
  }
  const toggleVisibleProject = (projectId: string) => {
    const toggle = toggleVisibleProjectId(projectId, visibleProjectIds)
    setVisibleProjectIdsOverride(toggle.nextProjectIds)
    if (toggle.shouldFocusProject) focusProject(projectId)
    if (toggle.shouldShowLanding) onShowView('landing')
  }
  const setProjectSwitcherOpenState = (open: boolean) => {
    if (open) setScopeSelectorOrderIds(visibleProjectIds)
    setProjectSwitcherOpen(open)
    if (open || storedVisibleProjectIds === null) return
    setScopeSelectorOrderIds(null)
    void onAction('workspace.sidebar-scope', { projectIds: storedVisibleProjectIds })
  }

  return {
    displayableProjects,
    displayableWorkspaces,
    focusProject,
    primeProject,
    projectScopeLabel,
    projectSwitcherOpen,
    scopeProject,
    scopeSelectorProjects,
    selectedProject,
    setProjectSwitcherOpen: setProjectSwitcherOpenState,
    toggleVisibleProject,
    visibleProjects,
  }
}
