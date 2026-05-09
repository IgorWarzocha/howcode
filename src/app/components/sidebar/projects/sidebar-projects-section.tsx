import {
  Clock3,
  FolderPlus,
  Github,
  ListFilter,
  RadioTower,
  Search,
  SquareTerminal,
  Star,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseGitHubRepositoryUrl } from '../../../../../shared/github-repository-url'
import type { HowcodeRemoteEnvironment } from '../../../../../shared/howcode-server-contracts'
import type { AppSettings, DesktopActionInvoker } from '../../../desktop/types'
import { useDesktopBridgeAvailable } from '../../../hooks/useDesktopBridge'
import { useDismissibleLayer } from '../../../hooks/useDismissibleLayer'
import type { Project, Thread, View } from '../../../types'
import { cn } from '../../../utils/cn'
import { IconButton } from '../../common/icon-button'
import { ProjectTree } from '../project-tree'
import { SidebarProjectsSkeleton } from '../sidebar-skeletons'
import {
  getSidebarVisibleProjects,
  type SidebarProjectsFilterMode,
} from './sidebar-projects.helpers'
import { SidebarProjectsCreatePopover } from './sidebar-projects-create-popover'

type PendingProject = {
  key: string
  name: string
}

type RemoteStatus = 'connecting' | 'failed' | 'connected' | null

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
  onOpenSettingsPanel: () => void
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
  onOpenSettingsPanel: () => void
  projectNameDraft: string
  setCreateErrorMessage: (message: string | null) => void
  setCreateOpen: (open: boolean) => void
}) {
  if (input.createBusy) return null
  input.setCreateErrorMessage(null)
  if (!input.appSettings.preferredProjectLocation) {
    input.setCreateOpen(false)
    input.onOpenSettingsPanel()
    return null
  }
  const draft = input.projectNameDraft.trim()
  return draft || null
}

function getCreateProjectPayload(draft: string) {
  const repository = parseGitHubRepositoryUrl(draft)
  return {
    pendingProjectName: repository?.folderName ?? draft,
    payload: repository ? { repoUrl: repository.canonicalUrl } : { projectName: draft },
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
  remoteProjectIds,
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
  remoteProjectIds?: ReadonlySet<string>
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
            remoteProjectIds={remoteProjectIds}
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

function useSidebarRemoteProjects(input: {
  activeView: View
  onLoadProjectThreads: (projectId: string, options?: { chat?: boolean }) => Promise<unknown>
}) {
  const [remoteStatus, setRemoteStatus] = useState<RemoteStatus>(null)
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const [remoteEnvironments, setRemoteEnvironments] = useState<HowcodeRemoteEnvironment[]>([])
  const [remoteProjects, setRemoteProjects] = useState<Project[]>([])
  const [activeRemoteEnvironmentId, setActiveRemoteEnvironmentId] = useState<string | null>(null)
  const [showRemoteProjects, setShowRemoteProjects] = useState(true)

  const refreshRemoteEnvironments = async () => {
    const remotes = (await window.piDesktop?.listHowcodeRemoteEnvironments?.()) ?? []
    setRemoteEnvironments(remotes)
  }

  const connectRemoteEnvironment = async (remoteEnvironmentId: string) => {
    setRemoteStatus('connecting')
    setRemoteError(null)
    try {
      await window.piDesktop?.setActiveHowcodeRemoteEnvironment?.(remoteEnvironmentId)
      const manifest = await window.piDesktop?.getHowcodeInstanceManifest?.()
      if (!manifest) throw new Error('Could not read remote instance.')
      const remoteProjectsWithoutThreads: Project[] = manifest.projects.map((project) => ({
        id: project.id,
        latestModifiedMs: project.latestModifiedMs ?? undefined,
        name: `${project.name} · ${manifest.instanceName}`,
        repoOriginUrl: project.repoOriginUrl ?? null,
        threadCount: project.threadCount ?? undefined,
        threads: [],
      }))
      const remoteProjectsWithThreads = await Promise.all(
        remoteProjectsWithoutThreads.map(async (project) => {
          const threads = (await input.onLoadProjectThreads(project.id, {
            chat: input.activeView === 'chat',
          })) as Thread[] | unknown
          return Array.isArray(threads)
            ? {
                ...project,
                threadCount: threads.length,
                threads,
                threadsLoaded: true,
                threadsScope: input.activeView === 'chat' ? ('chat' as const) : ('code' as const),
              }
            : project
        }),
      )
      setRemoteProjects(remoteProjectsWithThreads)
      setActiveRemoteEnvironmentId(remoteEnvironmentId)
      setShowRemoteProjects(true)
      setRemoteStatus('connected')
      return true
    } catch (error) {
      setActiveRemoteEnvironmentId(null)
      setRemoteStatus('failed')
      setRemoteError(error instanceof Error ? error.message : 'Could not connect remote.')
      return false
    }
  }

  const disconnectRemoteEnvironment = async () => {
    setRemoteStatus(null)
    setRemoteError(null)
    setRemoteProjects([])
    setActiveRemoteEnvironmentId(null)
    setShowRemoteProjects(true)
    await window.piDesktop?.clearActiveHowcodeRemoteEnvironment?.()
  }

  return {
    activeRemoteEnvironmentId,
    connectRemoteEnvironment,
    disconnectRemoteEnvironment,
    refreshRemoteEnvironments,
    remoteEnvironments,
    remoteError,
    remoteProjects,
    remoteStatus,
    setShowRemoteProjects,
    showRemoteProjects,
  }
}

function SidebarRemotesPopover({
  activeRemoteEnvironmentId,
  connectRemoteEnvironment,
  disconnectRemoteEnvironment,
  panelRef,
  remoteEnvironments,
  remoteError,
  remoteStatus,
  setRemotesOpen,
  setShowLocalProjects,
  setShowRemoteProjects,
  showLocalProjects,
  showRemoteProjects,
}: {
  activeRemoteEnvironmentId: string | null
  connectRemoteEnvironment: (remoteEnvironmentId: string) => Promise<boolean>
  disconnectRemoteEnvironment: () => Promise<void>
  panelRef: React.RefObject<HTMLDivElement | null>
  remoteEnvironments: HowcodeRemoteEnvironment[]
  remoteError: string | null
  remoteStatus: RemoteStatus
  setRemotesOpen: (open: boolean) => void
  setShowLocalProjects: (show: boolean) => void
  setShowRemoteProjects: (show: boolean) => void
  showLocalProjects: boolean
  showRemoteProjects: boolean
}) {
  return (
    <div
      ref={panelRef}
      className="absolute top-[calc(100%+0.375rem)] right-0 z-30 grid w-64 gap-1 rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--panel)] p-1.5 text-[12px] shadow-[var(--shadow)]"
    >
      <button
        type="button"
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[color:var(--surface-hover)]"
        onClick={() => setShowLocalProjects(!showLocalProjects)}
      >
        <span className="w-3 text-[color:var(--accent)]">{showLocalProjects ? '✓' : ''}</span>
        <span className="min-w-0 flex-1 truncate text-[color:var(--text)]">Local</span>
      </button>
      <div className="my-1 h-px bg-[color:var(--border-subtle)]" />
      {remoteEnvironments.length > 0 ? (
        remoteEnvironments.map((environment) => (
          <button
            key={environment.id}
            type="button"
            className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[color:var(--surface-hover)]"
            onClick={async () => {
              if (activeRemoteEnvironmentId === environment.id) {
                setShowRemoteProjects(!showRemoteProjects)
                return
              }
              await connectRemoteEnvironment(environment.id)
            }}
          >
            <span className="w-3 pt-px text-[color:var(--accent)]">
              {activeRemoteEnvironmentId === environment.id && showRemoteProjects ? '✓' : ''}
            </span>
            <span className="grid min-w-0 flex-1">
              <span className="truncate text-[color:var(--text)]">{environment.name}</span>
              <span className="truncate text-[11px] text-[color:var(--muted)]">
                {environment.kind === 'ssh'
                  ? `ssh ${environment.sshHost ?? ''}`
                  : environment.serverUrl}
              </span>
            </span>
          </button>
        ))
      ) : (
        <div className="px-2 py-1.5 text-[color:var(--muted)]">No remotes saved</div>
      )}
      {activeRemoteEnvironmentId ? (
        <button
          type="button"
          className="rounded-lg px-2 py-1.5 text-left text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
          onClick={async () => {
            await disconnectRemoteEnvironment()
            setRemotesOpen(false)
          }}
        >
          Disconnect and stop server
        </button>
      ) : null}
      {remoteStatus === 'connecting' ? (
        <div className="px-2 py-1 text-[color:var(--muted)]">Connecting…</div>
      ) : null}
      {remoteError ? (
        <div className="truncate px-2 py-1 text-[color:var(--danger)]" title={remoteError}>
          {remoteError}
        </div>
      ) : null}
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
  const [filterMode, setFilterMode] = useState<SidebarProjectsFilterMode>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [projectNameDraft, setProjectNameDraft] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(null)
  const [createdProjectIds, setCreatedProjectIds] = useState<string[]>([])
  const [pendingProject, setPendingProject] = useState<PendingProject | null>(null)
  const desktopBridgeAvailable = useDesktopBridgeAvailable()
  const createButtonRef = useRef<HTMLButtonElement>(null)
  const createPanelRef = useRef<HTMLDialogElement>(null)
  const remotesButtonRef = useRef<HTMLButtonElement>(null)
  const remotesPanelRef = useRef<HTMLDivElement>(null)
  const [remotesOpen, setRemotesOpen] = useState(false)
  const {
    activeRemoteEnvironmentId,
    connectRemoteEnvironment,
    disconnectRemoteEnvironment,
    refreshRemoteEnvironments,
    remoteEnvironments,
    remoteError,
    remoteProjects,
    remoteStatus,
    setShowRemoteProjects,
    showRemoteProjects,
  } = useSidebarRemoteProjects({ activeView, onLoadProjectThreads })

  const remoteProjectIds = useMemo(
    () => new Set(remoteProjects.map((project) => project.id)),
    [remoteProjects],
  )
  const [showLocalProjects, setShowLocalProjects] = useState(true)
  const combinedProjects = useMemo(
    () => [...(showLocalProjects ? projects : []), ...(showRemoteProjects ? remoteProjects : [])],
    [projects, remoteProjects, showLocalProjects, showRemoteProjects],
  )

  const { projects: visibleProjects, autoExpandedProjectIds } = useMemo(
    () =>
      getSidebarVisibleProjects({
        projects: combinedProjects,
        searchQuery,
        filterMode,
        terminalRunningProjectIds,
        terminalRunningSessionPaths,
        appLaunchedAtMs,
        priorityProjectIds: createdProjectIds,
      }),
    [
      appLaunchedAtMs,
      createdProjectIds,
      filterMode,
      combinedProjects,
      searchQuery,
      terminalRunningProjectIds,
      terminalRunningSessionPaths,
    ],
  )

  useEffect(() => {
    if (filterMode !== 'terminal' && filterMode !== 'recent' && searchQuery.trim().length === 0) {
      return
    }

    for (const project of visibleProjects) {
      const sourceProject = combinedProjects.find((candidate) => candidate.id === project.id)

      const shouldLoadSearchedProject = searchQuery.trim().length > 0
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
  }, [activeView, combinedProjects, filterMode, onLoadProjectThreads, searchQuery, visibleProjects])

  const effectiveCollapsedProjectIds = useMemo(() => {
    if (searchQuery.trim().length === 0) {
      return collapsedProjectIds
    }

    return {
      ...collapsedProjectIds,
      ...Object.fromEntries([...autoExpandedProjectIds].map((projectId) => [projectId, false])),
    }
  }, [autoExpandedProjectIds, collapsedProjectIds, searchQuery])

  const cycleFilterMode = () => {
    setFilterMode((current) => {
      if (current === 'all') {
        return 'favourites'
      }

      if (current === 'favourites') {
        return 'github'
      }

      if (current === 'github') {
        return 'terminal'
      }

      if (current === 'terminal') {
        return 'recent'
      }

      return 'all'
    })
  }

  const filterLabel = getSidebarProjectFilterLabel(filterMode)

  const dismissCreate = useCallback(() => {
    setCreateOpen(false)
  }, [])

  useDismissibleLayer({
    open: createOpen,
    onDismiss: dismissCreate,
    refs: [createButtonRef, createPanelRef],
  })

  useDismissibleLayer({
    open: remotesOpen,
    onDismiss: () => setRemotesOpen(false),
    refs: [remotesButtonRef, remotesPanelRef],
  })

  const handleCreateProject = async () => {
    const draft = prepareCreateProject({
      appSettings,
      createBusy,
      onOpenSettingsPanel,
      projectNameDraft,
      setCreateErrorMessage,
      setCreateOpen,
    })
    if (!draft) return

    const { payload, pendingProjectName } = getCreateProjectPayload(draft)
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

  if (!showProjects) {
    return <section className="sidebar-section" aria-hidden="true" />
  }

  return (
    <section className="sidebar-section">
      <div className="sidebar-toolbar">
        <label
          className="sidebar-search-field"
          data-active={searchQuery.trim().length > 0 ? 'true' : 'false'}
        >
          <Search size={14} className="sidebar-search-icon" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search"
            className="sidebar-search-input"
            aria-label="Search projects"
          />
        </label>
        {showProjects ? (
          <div className="sidebar-action-group">
            <IconButton
              label={filterLabel}
              tooltipPlacement="right"
              onClick={cycleFilterMode}
              icon={getSidebarProjectFilterIcon(filterMode)}
              active={filterMode !== 'all'}
            />
            {showProjectCreate ? (
              <IconButton
                ref={createButtonRef}
                label="Add new project"
                tooltipPlacement="right"
                onClick={() => {
                  if (!appSettings.preferredProjectLocation) {
                    onOpenSettingsPanel()
                    return
                  }

                  setCreateErrorMessage(null)
                  setCreateOpen(true)
                }}
                icon={<FolderPlus size={15} />}
              />
            ) : null}
            <IconButton
              ref={remotesButtonRef}
              label="Remotes"
              tooltipPlacement="right"
              onClick={() => {
                setRemotesOpen((open) => !open)
                void refreshRemoteEnvironments()
              }}
              icon={<RadioTower size={15} />}
              active={remoteProjects.length > 0 || remoteStatus === 'connected'}
            />
          </div>
        ) : null}

        {remotesOpen ? (
          <SidebarRemotesPopover
            activeRemoteEnvironmentId={activeRemoteEnvironmentId}
            connectRemoteEnvironment={connectRemoteEnvironment}
            disconnectRemoteEnvironment={disconnectRemoteEnvironment}
            panelRef={remotesPanelRef}
            remoteEnvironments={remoteEnvironments}
            remoteError={remoteError}
            remoteStatus={remoteStatus}
            setRemotesOpen={setRemotesOpen}
            setShowLocalProjects={setShowLocalProjects}
            setShowRemoteProjects={setShowRemoteProjects}
            showLocalProjects={showLocalProjects}
            showRemoteProjects={showRemoteProjects}
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
            onCreate={() => {
              void handleCreateProject()
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
        remoteProjectIds={remoteProjectIds}
        searchQuery={searchQuery}
        selectedProjectId={selectedProjectId}
        selectedThreadId={selectedThreadId}
        selectionModeActive={selectionModeActive}
        terminalRunningSessionPaths={terminalRunningSessionPaths}
        visibleProjects={visibleProjects}
      />
    </section>
  )
}
