import {
  Clock3,
  FolderPlus,
  Github,
  ListFilter,
  Search,
  SquareTerminal,
  Star,
  X,
} from 'lucide-react'
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { parseGitHubRepositoryUrl } from '../../../../../shared/github-repository-url'
import { useHowcodeKeybindingCommand } from '../../../app-shell/keybinding-events'
import type { AppSettings, DesktopActionInvoker } from '../../../desktop/types'
import { useDesktopBridgeAvailable } from '../../../hooks/useDesktopBridge'
import { useDismissibleLayer } from '../../../hooks/useDismissibleLayer'
import type { Project, View } from '../../../types'
import { cn } from '../../../utils/cn'
import type { SettingsOpenTarget } from '../../../views/settings/settingsTypes'
import { IconButton } from '../../common/icon-button'
import { ProjectTree } from '../project-tree'
import { SidebarProjectsSkeleton } from '../sidebar-skeletons'
import {
  getSidebarVisibleProjects,
  type SidebarProjectsFilterMode,
} from './sidebar-projects.helpers'
import { SidebarProjectsCreatePopover } from './sidebar-projects-create-popover'
import { SidebarProjectsFilterMenu } from './sidebar-projects-filter-menu'
import { getSidebarFolderProjectName } from './sidebar-projects-folder-browser'

type PendingProject = {
  key: string
  name: string
}

type SidebarProjectsSectionProps = {
  activeView: View
  appLaunchedAtMs: number
  appSettings: AppSettings
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
  onOpenSettingsPanel: (target?: SettingsOpenTarget) => void
  onProjectSelect: (projectId: string) => void
  onProjectPrimeSelection: (projectId: string) => void
  onProjectReorder: (projectIds: string[]) => void
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
  onToggleProjectCollapse: (projectId: string) => void
}

function shouldShowSidebarProjects(activeView: View) {
  return activeView !== 'inbox' && activeView !== 'claw' && activeView !== 'work'
}

function getSidebarProjectFilterLabel(filterMode: SidebarProjectsFilterMode) {
  if (filterMode === 'favourites') return 'Show favourites'
  if (filterMode === 'github') return 'Show GitHub projects'
  if (filterMode === 'terminal') return 'Show threads with running terminals'
  if (filterMode === 'recent') return 'Show threads active since launch'
  return 'Filter projects'
}

function getSidebarProjectFilterIcon(filterMode: SidebarProjectsFilterMode) {
  if (filterMode === 'favourites') return <Star size={15} className="fill-current" />
  if (filterMode === 'github') return <Github size={15} />
  if (filterMode === 'terminal') return <SquareTerminal size={15} />
  if (filterMode === 'recent') return <Clock3 size={15} />
  return <ListFilter size={15} />
}

function restoreCreateProjectDraft(input: {
  draft: string
  setCreateOpen: (open: boolean) => void
  setPendingProject: (project: PendingProject | null) => void
  setProjectNameDraft: (draft: string) => void
}) {
  input.setProjectNameDraft(input.draft)
  input.setCreateOpen(true)
  input.setPendingProject(null)
}

function recordCreatedProject(input: {
  result: Awaited<ReturnType<DesktopActionInvoker>>
  setCreatedProjectIds: React.Dispatch<React.SetStateAction<string[]>>
}) {
  const projectId =
    typeof input.result?.result?.projectId === 'string' ? input.result.result.projectId : null
  if (projectId)
    input.setCreatedProjectIds((current) => [
      projectId,
      ...current.filter((id) => id !== projectId),
    ])
}

function prepareCreateProject(input: {
  appSettings: AppSettings
  createBusy: boolean
  parentPath?: string | null | undefined
  onOpenSettingsPanel: (target?: SettingsOpenTarget) => void
  projectNameDraft: string
  setCreateErrorMessage: (message: string | null) => void
  setCreateOpen: (open: boolean) => void
}) {
  if (input.createBusy) return null
  input.setCreateErrorMessage(null)
  if (!(input.parentPath || input.appSettings.preferredProjectLocation)) {
    input.setCreateOpen(false)
    input.onOpenSettingsPanel({ category: 'projects', settingId: 'projects.default-location' })
    return null
  }
  const draft = input.projectNameDraft.trim()
  return draft || null
}

function getCreateProjectPayload(draft: string, parentPath?: string | null) {
  const repository = parseGitHubRepositoryUrl(draft)
  return {
    pendingProjectName: repository?.folderName ?? draft,
    payload: repository
      ? { repoUrl: repository.canonicalUrl, parentPath: parentPath ?? undefined }
      : { projectName: draft, parentPath: parentPath ?? undefined },
  }
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
  const [createOpen, setCreateOpen] = useState(false)
  const [projectNameDraft, setProjectNameDraft] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(null)
  const [createdProjectIds, setCreatedProjectIds] = useState<string[]>([])
  const [pendingProject, setPendingProject] = useState<PendingProject | null>(null)
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
  }, [])

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

  const handleCreateProject = async (options?: { parentPath?: string | null }) => {
    const draft = prepareCreateProject({
      appSettings,
      createBusy,
      parentPath: options?.parentPath,
      onOpenSettingsPanel,
      projectNameDraft,
      setCreateErrorMessage,
      setCreateOpen,
    })
    if (!draft) return

    const { payload, pendingProjectName } = getCreateProjectPayload(draft, options?.parentPath)
    setPendingProject({ key: `${Date.now()}:${draft}`, name: pendingProjectName })
    setProjectNameDraft('')
    setCreateOpen(false)
    setCreateBusy(true)

    try {
      const result = await onAction('project.add', payload)
      const error = typeof result?.result?.error === 'string' ? result.result.error : null

      if (error) {
        setCreateErrorMessage(error)
        restoreCreateProjectDraft({ draft, setCreateOpen, setPendingProject, setProjectNameDraft })
        return
      }

      recordCreatedProject({ result, setCreatedProjectIds })
      setPendingProject(null)
    } catch (error) {
      setCreateErrorMessage(error instanceof Error ? error.message : 'Unable to add project.')
      restoreCreateProjectDraft({ draft, setCreateOpen, setPendingProject, setProjectNameDraft })
    } finally {
      setCreateBusy(false)
    }
  }

  const handleAddFolderProject = async (projectPath: string, options?: { create?: boolean }) => {
    if (createBusy) return
    const pendingProjectName = getSidebarFolderProjectName(projectPath)
    setCreateErrorMessage(null)
    setPendingProject({ key: `${Date.now()}:${projectPath}`, name: pendingProjectName })
    setProjectNameDraft('')
    setCreateOpen(false)
    setCreateBusy(true)

    try {
      const result = await onAction('project.add', {
        projectPath,
        createIfMissing: options?.create === true,
      })
      const error = typeof result?.result?.error === 'string' ? result.result.error : null

      if (error) {
        setCreateErrorMessage(error)
        setCreateOpen(true)
        setPendingProject(null)
        return
      }

      recordCreatedProject({ result, setCreatedProjectIds })
      setPendingProject(null)
    } catch (error) {
      setCreateErrorMessage(error instanceof Error ? error.message : 'Unable to add project.')
      setCreateOpen(true)
      setPendingProject(null)
    } finally {
      setCreateBusy(false)
    }
  }

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
