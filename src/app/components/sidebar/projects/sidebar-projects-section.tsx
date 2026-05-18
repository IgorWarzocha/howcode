import { FolderPlus, Search, X } from 'lucide-react'
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useHowcodeKeybindingCommand } from '../../../app-shell/keybinding-events'
import type { DesktopActionInvoker } from '../../../desktop/types'
import { useDesktopBridgeAvailable } from '../../../hooks/useDesktopBridge'
import { useDismissibleLayer } from '../../../hooks/useDismissibleLayer'
import type { Project, View } from '../../../types'
import { cn } from '../../../utils/cn'
import { IconButton } from '../../common/icon-button'
import { ProjectTree } from '../project-tree'
import { SidebarProjectsSkeleton } from '../sidebar-skeletons'
import {
  getSidebarVisibleProjects,
  type SidebarProjectsFilterMode,
} from './sidebar-projects.helpers'
import { SidebarProjectsCreatePopover } from './sidebar-projects-create-popover'
import { SidebarProjectsFilterMenu } from './sidebar-projects-filter-menu'
import {
  getSidebarProjectFilterIcon,
  getSidebarProjectFilterLabel,
  shouldShowSidebarProjects,
} from './sidebar-projects-filter-ui'
import { type PendingProject, useSidebarProjectCreation } from './useSidebarProjectCreation'

type SidebarProjectsSectionProps = {
  activeView: View
  appLaunchedAtMs: number
  appSettings: import('../../../desktop/types').AppSettings
  protectedProjectId?: string | null
  projectScopeLockActive: boolean
  projects: Project[]
  loading?: boolean
  selectedProjectId: string
  selectedThreadId: string | null
  terminalRunningProjectIds: ReadonlySet<string>
  terminalRunningSessionPaths: ReadonlySet<string>
  collapsedProjectIds: Record<string, boolean>
  onAction: DesktopActionInvoker
  onLoadProjectThreads: (projectId: string, options?: { chat?: boolean }) => Promise<unknown>
  onOpenSettingsPanel: (
    target?: import('../../../views/settings/settingsTypes').SettingsOpenTarget,
  ) => void
  onProjectSelect: (projectId: string) => void
  onProjectPrimeSelection: (projectId: string) => void
  onProjectReorder: (projectIds: string[]) => void
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
  onToggleProjectCollapse: (projectId: string) => void
}

function PendingProjectRow({ pendingProject }: { pendingProject: PendingProject }) {
  return (
    <div className="sidebar-tree-item" aria-live="polite">
      <div className="sidebar-project-row sidebar-row-surface motion-surface-pulse">
        <span className="sidebar-project-toggle" data-can-toggle="false">
          <FolderPlus size={12} className="sidebar-project-icon sidebar-project-origin-icon" />
        </span>
        <div
          role="status"
          className="sidebar-project-button"
          aria-label={`Adding ${pendingProject.name}`}
        >
          <span className="sidebar-project-title">{pendingProject.name}</span>
        </div>
        <span className="text-[11px] text-[color:var(--muted-2)]">Adding…</span>
      </div>
    </div>
  )
}

function SidebarProjectsContent({
  activeView,
  desktopBridgeAvailable,
  effectiveCollapsedProjectIds,
  filterMode,
  loading,
  onAction,
  onProjectPrimeSelection,
  onProjectReorder,
  onProjectSelect,
  onThreadOpen,
  onToggleProjectCollapse,
  pendingProject,
  protectedProjectId,
  searchQuery,
  selectedProjectId,
  selectedThreadId,
  selectionModeActive,
  terminalRunningSessionPaths,
  visibleProjects,
}: {
  activeView: View
  desktopBridgeAvailable: boolean
  effectiveCollapsedProjectIds: Record<string, boolean>
  filterMode: SidebarProjectsFilterMode
  loading: boolean
  onAction: DesktopActionInvoker
  onProjectPrimeSelection: (projectId: string) => void
  onProjectReorder: (projectIds: string[]) => void
  onProjectSelect: (projectId: string) => void
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
  onToggleProjectCollapse: (projectId: string) => void
  pendingProject: PendingProject | null
  protectedProjectId: string | null
  searchQuery: string
  selectedProjectId: string
  selectedThreadId: string | null
  selectionModeActive: boolean
  terminalRunningSessionPaths: ReadonlySet<string>
  visibleProjects: Project[]
}) {
  if (loading && visibleProjects.length === 0 && !pendingProject) return <SidebarProjectsSkeleton />
  if (visibleProjects.length > 0 || pendingProject)
    return (
      <>
        {pendingProject ? <PendingProjectRow pendingProject={pendingProject} /> : null}
        {visibleProjects.length > 0 ? (
          <ProjectTree
            projects={visibleProjects}
            protectedProjectId={protectedProjectId}
            selectedProjectId={selectedProjectId}
            selectedThreadId={selectedThreadId}
            terminalRunningSessionPaths={terminalRunningSessionPaths}
            activeView={activeView}
            selectionModeActive={selectionModeActive}
            revealOldThreads={searchQuery.trim().length > 0}
            collapsedProjectIds={effectiveCollapsedProjectIds}
            onAction={onAction}
            onProjectSelect={onProjectSelect}
            onProjectPrimeSelection={onProjectPrimeSelection}
            onProjectReorder={onProjectReorder}
            onThreadOpen={onThreadOpen}
            onToggleProjectCollapse={onToggleProjectCollapse}
          />
        ) : null}
      </>
    )
  if (desktopBridgeAvailable)
    return (
      <div
        className={cn(
          'px-2.5 py-2 text-[13px] text-[color:var(--muted-2)]',
          searchQuery.trim().length > 0 || filterMode !== 'all' ? '' : 'hidden',
        )}
      >
        No matching projects
      </div>
    )
  return (
    <div className="px-2.5 py-2 text-[12px] leading-5 text-[color:var(--muted-2)]">
      Project sync needs the desktop bridge. Restart the dev server or use <code>bun run dev</code>.
    </div>
  )
}

export function SidebarProjectsSection({
  activeView,
  appLaunchedAtMs,
  appSettings,
  protectedProjectId = null,
  projectScopeLockActive,
  projects,
  loading = false,
  selectedProjectId,
  selectedThreadId,
  terminalRunningProjectIds,
  terminalRunningSessionPaths,
  collapsedProjectIds,
  onAction,
  onLoadProjectThreads,
  onOpenSettingsPanel,
  onProjectSelect,
  onProjectPrimeSelection,
  onProjectReorder,
  onThreadOpen,
  onToggleProjectCollapse,
}: SidebarProjectsSectionProps) {
  const showProjects = shouldShowSidebarProjects(activeView)
  const selectionModeActive =
    (activeView === 'extensions' || activeView === 'skills') && projectScopeLockActive
  const showProjectCreate = activeView !== 'extensions' && activeView !== 'skills'
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [filterMode, setFilterMode] = useState<SidebarProjectsFilterMode>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const {
    createBusy,
    createErrorMessage,
    createdProjectIds,
    createOpen,
    handleAddFolderProject,
    handleCreateProject,
    pendingProject,
    projectNameDraft,
    setCreateErrorMessage,
    setCreateOpen,
    setProjectNameDraft,
  } = useSidebarProjectCreation({ appSettings, onAction, onOpenSettingsPanel })
  const desktopBridgeAvailable = useDesktopBridgeAvailable()
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const filterPanelRef = useRef<HTMLDivElement>(null)
  const createButtonRef = useRef<HTMLButtonElement>(null)
  const createPanelRef = useRef<HTMLDialogElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { projects: visibleProjects, autoExpandedProjectIds } = useMemo(
    () =>
      getSidebarVisibleProjects({
        projects,
        searchQuery: deferredSearchQuery,
        filterMode,
        terminalRunningProjectIds,
        terminalRunningSessionPaths,
        appLaunchedAtMs,
        priorityProjectIds: createdProjectIds,
      }),
    [
      appLaunchedAtMs,
      createdProjectIds,
      deferredSearchQuery,
      filterMode,
      projects,
      terminalRunningProjectIds,
      terminalRunningSessionPaths,
    ],
  )

  useEffect(() => {
    if (
      filterMode !== 'terminal' &&
      filterMode !== 'recent' &&
      deferredSearchQuery.trim().length === 0
    ) {
      return
    }

    const projectsById = new Map(projects.map((project) => [project.id, project]))
    for (const project of visibleProjects) {
      const sourceProject = projectsById.get(project.id)

      const shouldLoadSearchedProject = deferredSearchQuery.trim().length > 0
      const hasIndexedThreads = (sourceProject?.threadCount ?? project.threadCount ?? 0) > 0

      const threadsScope = activeView === 'chat' ? 'chat' : 'code'
      if (
        (project.threadsLoaded && project.threadsScope === threadsScope) ||
        !(shouldLoadSearchedProject || hasIndexedThreads)
      ) {
        continue
      }

      void onLoadProjectThreads(project.id, { chat: activeView === 'chat' })
    }
  }, [activeView, deferredSearchQuery, filterMode, onLoadProjectThreads, projects, visibleProjects])

  const effectiveCollapsedProjectIds = useMemo(() => {
    if (deferredSearchQuery.trim().length === 0) {
      return collapsedProjectIds
    }

    return {
      ...collapsedProjectIds,
      ...Object.fromEntries([...autoExpandedProjectIds].map((projectId) => [projectId, false])),
    }
  }, [autoExpandedProjectIds, collapsedProjectIds, deferredSearchQuery])

  const filterLabel = getSidebarProjectFilterLabel(filterMode)

  const dismissFilter = useCallback(() => {
    setFilterOpen(false)
  }, [])

  const dismissCreate = useCallback(() => {
    setCreateOpen(false)
  }, [setCreateOpen])

  useDismissibleLayer({
    open: filterOpen,
    onDismiss: dismissFilter,
    refs: [filterButtonRef, filterPanelRef],
  })

  useDismissibleLayer({
    open: createOpen,
    onDismiss: dismissCreate,
    refs: [createButtonRef, createPanelRef],
  })

  useHowcodeKeybindingCommand('sidebar.find', (event) => {
    event.preventDefault()
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  })

  if (!showProjects) {
    return <section className="sidebar-section" aria-hidden="true" />
  }

  return (
    <section className="sidebar-section">
      <div className="sidebar-toolbar">
        <div
          className="sidebar-search-field"
          data-active={searchQuery.trim().length > 0 ? 'true' : 'false'}
        >
          <Search size={14} className="sidebar-search-icon" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Escape' || searchQuery.length === 0) return
              event.preventDefault()
              event.stopPropagation()
              setSearchQuery('')
            }}
            placeholder="Search"
            className="sidebar-search-input"
            aria-label="Search projects"
          />
          {searchQuery.length > 0 ? (
            <button
              type="button"
              className="sidebar-search-clear"
              aria-label="Clear project search"
              onClick={() => setSearchQuery('')}
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
        {showProjects ? (
          <div className="sidebar-action-group">
            <IconButton
              ref={filterButtonRef}
              label={filterLabel}
              tooltipPlacement="right"
              onClick={() => {
                setCreateOpen(false)
                setFilterOpen((open) => !open)
              }}
              icon={getSidebarProjectFilterIcon(filterMode)}
              active={filterMode !== 'all'}
              aria-haspopup="menu"
              aria-expanded={filterOpen}
              aria-controls="sidebar-project-filter-menu"
            />
            {showProjectCreate ? (
              <IconButton
                ref={createButtonRef}
                label="Add new project"
                tooltipPlacement="right"
                onClick={() => {
                  setCreateErrorMessage(null)
                  setFilterOpen(false)
                  setCreateOpen(true)
                }}
                icon={<FolderPlus size={15} />}
              />
            ) : null}
          </div>
        ) : null}

        {filterOpen ? (
          <SidebarProjectsFilterMenu
            menuId="sidebar-project-filter-menu"
            open={filterOpen}
            filterMode={filterMode}
            panelRef={filterPanelRef}
            onSelect={(nextFilterMode) => {
              setFilterMode(nextFilterMode)
              setFilterOpen(false)
            }}
          />
        ) : null}

        {createOpen ? (
          <SidebarProjectsCreatePopover
            menuId="sidebar-project-create-dialog"
            open={createOpen}
            draft={projectNameDraft}
            defaultLocation={appSettings.preferredProjectLocation}
            busy={createBusy}
            errorMessage={createErrorMessage}
            panelRef={createPanelRef}
            onChangeDraft={setProjectNameDraft}
            onCreate={(options) => {
              void handleCreateProject(options)
            }}
            onAddFolder={(projectPath) => {
              void handleAddFolderProject(projectPath)
            }}
            onClose={() => {
              setCreateOpen(false)
              setCreateErrorMessage(null)
            }}
          />
        ) : null}
      </div>

      <SidebarProjectsContent
        activeView={activeView}
        desktopBridgeAvailable={desktopBridgeAvailable}
        effectiveCollapsedProjectIds={effectiveCollapsedProjectIds}
        filterMode={filterMode}
        loading={loading}
        onAction={onAction}
        onProjectPrimeSelection={onProjectPrimeSelection}
        onProjectReorder={onProjectReorder}
        onProjectSelect={onProjectSelect}
        onThreadOpen={onThreadOpen}
        onToggleProjectCollapse={onToggleProjectCollapse}
        pendingProject={pendingProject}
        protectedProjectId={protectedProjectId}
        searchQuery={deferredSearchQuery}
        selectedProjectId={selectedProjectId}
        selectedThreadId={selectedThreadId}
        selectionModeActive={selectionModeActive}
        terminalRunningSessionPaths={terminalRunningSessionPaths}
        visibleProjects={visibleProjects}
      />
    </section>
  )
}
