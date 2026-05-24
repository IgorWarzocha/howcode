import { IconButton } from '@howcode/common/icon-button'
import { Tooltip } from '@howcode/common/tooltip'
import {
  Archive,
  Bot,
  ChevronDown,
  ChevronRight,
  FolderCode,
  GitBranch,
  GitFork,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DesktopActionInvoker, ProjectGitState } from '../../desktop/types'
import type { Project, Thread, View } from '../../types'
import { appToneSubtleClass, appTypeMetaClass } from '../../ui/classes'
import { cn } from '../../utils/cn'
import { ThreadRow } from './project-tree/thread-row'
import { SidebarProjectsSkeleton } from './sidebar-skeletons'

const OLD_THREAD_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000
const UNASSIGNED_BRANCH_GROUP_ID = '__unassigned__'

type WorkSidebarSectionProps = {
  activeView: View
  loading: boolean
  projects: Project[]
  projectGitState: ProjectGitState | null
  selectedProjectId: string
  selectedThreadId: string | null
  terminalRunningProjectIds: ReadonlySet<string>
  terminalRunningSessionPaths: ReadonlySet<string>
  onAction: DesktopActionInvoker
  onLoadProjectThreads: (projectId: string, options?: { chat?: boolean }) => Promise<unknown>
  onOpenArchivedThreads: () => void
  onProjectSelect: (projectId: string) => void
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
  onShowView: (view: Exclude<View, 'gitops'>) => void
}

type ThreadBuckets = {
  activeThreads: Thread[]
  olderThreads: Thread[]
}

type BranchThreadGroup = {
  id: string
  label: string
  threads: Thread[]
  current: boolean
  unassigned: boolean
}

function getDirtyWorktreeMessage(projectGitState: ProjectGitState | null, projectId: string) {
  if (projectGitState?.projectId !== projectId || !projectGitState.isGitRepo) return null
  const dirtyFileCount =
    projectGitState.stagedFileCount +
    projectGitState.unstagedFileCount +
    projectGitState.untrackedFileCount
  return dirtyFileCount > 0 ? 'Commit first' : null
}

function getThreadSortValue(thread: Thread) {
  return thread.lastModifiedMs ?? 0
}

function sortThreads(threads: Thread[]) {
  return [...threads].sort((a, b) => getThreadSortValue(b) - getThreadSortValue(a))
}

function bucketThreads(project: Project, selectedThreadId: string | null): ThreadBuckets {
  const sortedThreads = sortThreads(project.threads)
  const cutoffMs = Date.now() - OLD_THREAD_THRESHOLD_MS
  const activeThreads: Thread[] = []
  const olderThreads: Thread[] = []

  for (const thread of sortedThreads) {
    const shouldKeepVisible =
      thread.id === selectedThreadId ||
      Boolean(thread.pinned) ||
      Boolean(thread.running) ||
      Boolean(thread.unread) ||
      (thread.lastModifiedMs ?? Number.MAX_SAFE_INTEGER) >= cutoffMs

    if (shouldKeepVisible) {
      activeThreads.push(thread)
    } else {
      olderThreads.push(thread)
    }
  }

  return { activeThreads, olderThreads }
}

function buildBranchGroups(
  threads: Thread[],
  currentBranch: string | null,
  repositoryBranches: readonly string[],
): BranchThreadGroup[] {
  const groupedThreads = new Map<string, Thread[]>()
  const unassignedThreads: Thread[] = []

  for (const thread of threads) {
    const branchName = thread.branchName?.trim()
    if (!branchName) {
      unassignedThreads.push(thread)
      continue
    }

    const branchThreads = groupedThreads.get(branchName) ?? []
    branchThreads.push(thread)
    groupedThreads.set(branchName, branchThreads)
  }

  const branchNames = new Set<string>()
  for (const branch of repositoryBranches) {
    const normalizedBranch = branch.trim()
    if (normalizedBranch) branchNames.add(normalizedBranch)
  }
  for (const branchName of groupedThreads.keys()) branchNames.add(branchName)
  if (currentBranch) branchNames.add(currentBranch)

  const groups: BranchThreadGroup[] = []
  if (currentBranch && branchNames.has(currentBranch)) {
    groups.push({
      id: currentBranch,
      label: currentBranch,
      threads: sortThreads(groupedThreads.get(currentBranch) ?? []),
      current: true,
      unassigned: false,
    })
    branchNames.delete(currentBranch)
  }

  const otherBranchGroups = [...branchNames]
    .map((branchName) => ({
      id: branchName,
      label: branchName,
      threads: sortThreads(groupedThreads.get(branchName) ?? []),
      current: false,
      unassigned: false,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  groups.push(...otherBranchGroups)

  if (unassignedThreads.length > 0) {
    groups.push({
      id: UNASSIGNED_BRANCH_GROUP_ID,
      label: 'Unassigned',
      threads: sortThreads(unassignedThreads),
      current: false,
      unassigned: true,
    })
  }

  if (groups.length === 0) {
    groups.push({
      id: UNASSIGNED_BRANCH_GROUP_ID,
      label: 'Unassigned',
      threads: [],
      current: false,
      unassigned: true,
    })
  }

  return groups
}

function ProjectOptionRow({
  active,
  project,
  running,
  onSelect,
}: {
  active: boolean
  project: Project
  running: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className="sidebar-work-project-option"
      data-active={active ? 'true' : 'false'}
      onClick={onSelect}
    >
      <FolderCode size={13} />
      <span className="truncate">{project.name}</span>
      {running ? (
        <span className="sidebar-work-live-dot" title="Running terminal" aria-hidden="true" />
      ) : null}
    </button>
  )
}

function WorkThreadRow({
  activeView,
  project,
  selectedThreadId,
  terminalRunningSessionPaths,
  thread,
  currentBranch,
  onAction,
  onThreadOpen,
}: {
  activeView: View
  project: Project
  selectedThreadId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  thread: Thread
  currentBranch: string | null
  onAction: DesktopActionInvoker
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
}) {
  const isSelected =
    selectedThreadId === thread.id &&
    (activeView === 'thread' || activeView === 'project' || activeView === 'gitops')

  return (
    <ThreadRow
      age={thread.age}
      pinned={Boolean(thread.pinned)}
      running={Boolean(thread.running)}
      terminalRunning={Boolean(
        thread.sessionPath && terminalRunningSessionPaths.has(thread.sessionPath),
      )}
      unread={Boolean(thread.unread)}
      isSelected={isSelected}
      title={thread.title}
      assignBranchLabel={
        currentBranch && thread.branchName === currentBranch
          ? `Unassign from ${currentBranch}`
          : currentBranch
            ? `Assign to ${currentBranch}`
            : 'Clear assigned branch'
      }
      onArchive={() =>
        onAction('thread.archive', {
          projectId: project.id,
          threadId: thread.id,
        })
      }
      onAssignToBranch={() =>
        onAction('thread.assign-branch', {
          projectId: project.id,
          threadId: thread.id,
          branchName: currentBranch && thread.branchName === currentBranch ? null : currentBranch,
        })
      }
      onOpen={() => {
        if (!thread.sessionPath) return
        onThreadOpen(project.id, thread.id, thread.sessionPath)
      }}
      onPin={() =>
        onAction('thread.pin', {
          projectId: project.id,
          threadId: thread.id,
        })
      }
    />
  )
}

function BranchSwitchAction({
  blocked,
  group,
  project,
  onAction,
  onBlocked,
}: {
  blocked: boolean
  group: BranchThreadGroup
  project: Project
  onAction: DesktopActionInvoker
  onBlocked: () => void
}) {
  return (
    <Tooltip
      content={blocked ? 'Worktree is dirty. Commit first.' : `Switch to ${group.label}`}
      placement="right"
    >
      <button
        type="button"
        className="sidebar-work-branch-action"
        onClick={(event) => {
          event.stopPropagation()
          void onAction('workspace.switch-branch', {
            projectId: project.id,
            value: group.label,
          }).then((result) => {
            const error = result?.result?.error
            if (typeof error === 'string' && error.includes('Worktree is dirty')) onBlocked()
          })
        }}
        aria-label={`Switch to ${group.label}`}
      >
        <GitBranch size={12} />
      </button>
    </Tooltip>
  )
}

function BranchPruneAction({
  group,
  project,
  confirming,
  onAction,
  onCancel,
  onConfirm,
  onRequestConfirm,
}: {
  group: BranchThreadGroup
  project: Project
  confirming: boolean
  onAction: DesktopActionInvoker
  onCancel: () => void
  onConfirm: () => void
  onRequestConfirm: () => void
}) {
  if (confirming) {
    return (
      <>
        <button
          type="button"
          className="sidebar-work-branch-action"
          onClick={(event) => {
            event.stopPropagation()
            onCancel()
          }}
          aria-label="Cancel prune"
        >
          <X size={12} />
        </button>
        <button
          type="button"
          className="sidebar-work-branch-action sidebar-work-branch-action--danger"
          onClick={(event) => {
            event.stopPropagation()
            onConfirm()
            void onAction('workspace.prune-branch', {
              projectId: project.id,
              branchName: group.label,
            })
          }}
          aria-label={`Confirm prune ${group.label}`}
        >
          <Trash2 size={12} />
        </button>
      </>
    )
  }

  return (
    <Tooltip content={`Prune ${group.label}`} placement="right">
      <button
        type="button"
        className="sidebar-work-branch-action"
        onClick={(event) => {
          event.stopPropagation()
          onRequestConfirm()
        }}
        aria-label={`Prune ${group.label}`}
      >
        <Trash2 size={12} />
      </button>
    </Tooltip>
  )
}

function filterBranchGroups(groups: BranchThreadGroup[], searchQuery: string) {
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  if (!normalizedSearchQuery) return groups

  return groups
    .map((group) => ({
      ...group,
      threads: group.threads.filter((thread) =>
        [thread.title, thread.summary ?? '', thread.branchName ?? group.label]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearchQuery),
      ),
    }))
    .filter(
      (group) =>
        group.label.toLowerCase().includes(normalizedSearchQuery) || group.threads.length > 0,
    )
}

function BranchThreadGroupSection({
  activeView,
  collapsed,
  currentBranch,
  group,
  project,
  selectedThreadId,
  terminalRunningSessionPaths,
  onAction,
  onThreadOpen,
  onToggle,
  pruneConfirmBranchId,
  onSetPruneConfirmBranchId,
  switchErrorBranchId,
  onSetSwitchErrorBranchId,
}: {
  activeView: View
  collapsed: boolean
  currentBranch: string | null
  group: BranchThreadGroup
  project: Project
  selectedThreadId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  onAction: DesktopActionInvoker
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
  onToggle: () => void
  pruneConfirmBranchId: string | null
  onSetPruneConfirmBranchId: (branchId: string | null) => void
  switchErrorBranchId: string | null
  onSetSwitchErrorBranchId: (branchId: string | null) => void
}) {
  const canManageBranch = !(group.current || group.unassigned)
  const confirmingPrune = pruneConfirmBranchId === group.id
  const switchBlocked = switchErrorBranchId === group.id

  return (
    <section className="sidebar-work-branch-group" data-current={group.current ? 'true' : 'false'}>
      <div className="sidebar-work-branch-heading">
        <button
          type="button"
          className="sidebar-work-branch-disclosure"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${group.label}` : `Collapse ${group.label}`}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        </button>
        <button
          type="button"
          className="sidebar-work-branch-toggle"
          onClick={onToggle}
          aria-expanded={!collapsed}
        >
          {/* TODO(worktrees): swap this for a dynamic work-context icon once worktrees land. Branches can keep GitBranch; worktrees likely need a custom SVG. */}
          <GitBranch size={13} className="sidebar-work-branch-icon" />
          <span className="truncate">{group.label}</span>
        </button>
        <span className="sidebar-work-branch-meta">
          {group.current ? <span className="sidebar-work-branch-current">Current</span> : null}
          <span className="sidebar-work-branch-count">{group.threads.length}</span>
        </span>
        <span
          className="sidebar-work-branch-actions"
          data-confirming={confirmingPrune ? 'true' : 'false'}
        >
          {canManageBranch && !confirmingPrune ? (
            <BranchSwitchAction
              blocked={switchBlocked}
              group={group}
              project={project}
              onAction={onAction}
              onBlocked={() => onSetSwitchErrorBranchId(group.id)}
            />
          ) : null}
          {canManageBranch ? (
            <BranchPruneAction
              confirming={confirmingPrune}
              group={group}
              project={project}
              onAction={onAction}
              onCancel={() => onSetPruneConfirmBranchId(null)}
              onConfirm={() => onSetPruneConfirmBranchId(null)}
              onRequestConfirm={() => onSetPruneConfirmBranchId(group.id)}
            />
          ) : null}
        </span>
      </div>

      {collapsed ? null : (
        <div className="sidebar-work-branch-thread-list">
          {group.threads.length > 0 ? (
            group.threads.map((thread) => (
              <WorkThreadRow
                key={thread.id}
                activeView={activeView}
                project={project}
                selectedThreadId={selectedThreadId}
                terminalRunningSessionPaths={terminalRunningSessionPaths}
                thread={thread}
                onAction={onAction}
                onThreadOpen={onThreadOpen}
                currentBranch={currentBranch}
              />
            ))
          ) : (
            <div className="sidebar-work-branch-empty">No threads assigned here yet.</div>
          )}
        </div>
      )}
    </section>
  )
}

async function createThreadForBranch({
  branchName,
  onAction,
  projectId,
}: {
  branchName: string | null
  onAction: DesktopActionInvoker
  projectId: string
}) {
  await onAction('thread.new', {
    projectId,
    composerMode: 'code',
    branchName,
  })
}

function NewThreadMenu({
  currentBranch,
  dirtyMessage,
  onAction,
  projectId,
}: {
  currentBranch: string | null
  dirtyMessage: string | null
  onAction: DesktopActionInvoker
  projectId: string
}) {
  const [open, setOpen] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [newBranchError, setNewBranchError] = useState<string | null>(null)
  const [menuWidth, setMenuWidth] = useState(240)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!(open && menuRef.current)) return
    const anchor = menuRef.current
    setMenuWidth(anchor.offsetLeft + anchor.offsetWidth)
  }, [open])

  const createAssignedThread = async (branchName: string | null) => {
    await createThreadForBranch({ branchName, onAction, projectId })
    setOpen(false)
  }

  const createThreadOnNewBranch = async () => {
    const branchName = newBranchName.trim()
    if (!branchName) return
    if (dirtyMessage) {
      setNewBranchError(dirtyMessage)
      return
    }
    setNewBranchError(null)
    const switchResult = await onAction('workspace.switch-branch', {
      projectId,
      value: branchName,
    })
    const switchError = switchResult?.result?.error
    if (!switchResult?.ok || switchError) {
      setNewBranchError(
        typeof switchError === 'string' && switchError.trim().length > 0
          ? switchError
          : 'Could not create branch.',
      )
      return
    }
    await createThreadForBranch({ branchName, onAction, projectId })
    setNewBranchName('')
    setNewBranchError(null)
    setOpen(false)
  }

  return (
    <div ref={menuRef} className="sidebar-new-thread-menu-anchor">
      <IconButton
        label="New thread"
        icon={<Plus size={14} />}
        tooltipPlacement="right"
        className="h-7 w-7 rounded-md"
        onClick={() => setOpen((current) => !current)}
      />
      {open ? (
        <div
          className="sidebar-new-thread-menu"
          style={{ width: `${menuWidth}px` }}
          role="menu"
          aria-label="New thread options"
        >
          <button
            type="button"
            className="sidebar-new-thread-option"
            onClick={() => void createAssignedThread(currentBranch)}
            disabled={!currentBranch}
          >
            <GitBranch size={12} />
            <span className="truncate">Current branch</span>
            <span className="sidebar-new-thread-option-meta truncate">
              {currentBranch ?? 'No branch'}
            </span>
          </button>

          <div className="sidebar-new-thread-branch-create">
            <GitBranch size={12} />
            <input
              value={newBranchName}
              onChange={(event) => {
                setNewBranchName(event.target.value)
                setNewBranchError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void createThreadOnNewBranch()
                if (event.key === 'Escape') setOpen(false)
              }}
              placeholder="New branch"
              aria-label="New branch name"
            />
            <button
              type="button"
              data-warning={newBranchError || dirtyMessage ? 'true' : 'false'}
              onClick={() => void createThreadOnNewBranch()}
              disabled={newBranchName.trim().length === 0}
            >
              {newBranchError || dirtyMessage ? (newBranchError ?? dirtyMessage) : 'Create'}
            </button>
          </div>

          <button type="button" className="sidebar-new-thread-option" disabled>
            <GitFork size={12} />
            <span className="truncate">New worktree</span>
            <span className="sidebar-new-thread-option-meta">Soon</span>
          </button>

          <button
            type="button"
            className="sidebar-new-thread-option"
            onClick={() => void createAssignedThread(null)}
          >
            <X size={12} />
            <span className="truncate">Unassigned</span>
            <span className="sidebar-new-thread-option-meta">No branch</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function WorkSidebarSection({
  activeView,
  loading,
  projects,
  projectGitState,
  selectedProjectId,
  selectedThreadId,
  terminalRunningProjectIds,
  terminalRunningSessionPaths,
  onAction,
  onLoadProjectThreads,
  onOpenArchivedThreads,
  onProjectSelect,
  onThreadOpen,
  onShowView,
}: WorkSidebarSectionProps) {
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedBranchIds, setCollapsedBranchIds] = useState<Record<string, boolean>>({})
  const [pruneConfirmBranchId, setPruneConfirmBranchId] = useState<string | null>(null)
  const [switchErrorBranchId, setSwitchErrorBranchId] = useState<string | null>(null)
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null

  useEffect(() => {
    if (!selectedProject || selectedProject.threadsLoaded) return
    void onLoadProjectThreads(selectedProject.id, { chat: false })
  }, [onLoadProjectThreads, selectedProject])

  if (loading && projects.length === 0) return <SidebarProjectsSkeleton />

  if (!selectedProject) {
    return (
      <section className="sidebar-work-section" aria-label="Work">
        <div className="sidebar-work-empty">
          <FolderCode size={18} />
          <span>No projects yet</span>
        </div>
      </section>
    )
  }

  const { activeThreads, olderThreads } = bucketThreads(selectedProject, selectedThreadId)
  const threadCount = selectedProject.threadCount ?? selectedProject.threads.length
  const currentBranch =
    projectGitState?.projectId === selectedProject.id && projectGitState.isGitRepo
      ? projectGitState.branch
      : null
  const repositoryBranches =
    projectGitState?.projectId === selectedProject.id && projectGitState.isGitRepo
      ? projectGitState.branches
      : []
  const branchGroups = buildBranchGroups(activeThreads, currentBranch, repositoryBranches)
  const dirtyWorktreeMessage = getDirtyWorktreeMessage(projectGitState, selectedProject.id)
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const visibleBranchGroups = filterBranchGroups(branchGroups, searchQuery)
  const selectedThread = selectedProject.threads.find((thread) => thread.id === selectedThreadId)
  const selectedGroupId = selectedThread?.branchName?.trim() || UNASSIGNED_BRANCH_GROUP_ID

  return (
    <section className="sidebar-work-section" aria-label="Project work">
      <div className="sidebar-work-project-card">
        <div className="sidebar-work-project-kicker">Project</div>
        <button
          type="button"
          className="sidebar-work-project-button"
          onClick={() => setProjectSwitcherOpen((open) => !open)}
          aria-expanded={projectSwitcherOpen}
        >
          <span className="truncate">{selectedProject.name}</span>
          <ChevronDown size={14} />
        </button>
        {projectSwitcherOpen ? (
          <div className="sidebar-work-project-list">
            {projects.map((project) => (
              <ProjectOptionRow
                key={project.id}
                project={project}
                active={project.id === selectedProject.id}
                running={terminalRunningProjectIds.has(project.id)}
                onSelect={() => {
                  onProjectSelect(project.id)
                  void onAction('project.select', { projectId: project.id })
                  setProjectSwitcherOpen(false)
                }}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="sidebar-work-actions">
        <button
          type="button"
          className="sidebar-work-action-row"
          data-active={activeView === 'automations' ? 'true' : 'false'}
          onClick={() => onShowView('automations')}
        >
          <Bot size={15} />
          <span>Automations</span>
          <span className="sidebar-work-pill">Soon</span>
        </button>
      </div>

      <div className="sidebar-work-lane">
        <div className="sidebar-work-section-heading">
          <label
            className="sidebar-search-field sidebar-work-search-field"
            data-active={searchQuery.trim().length > 0 ? 'true' : 'false'}
          >
            <Search size={14} className="sidebar-search-icon" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Escape' || searchQuery.length === 0) return
                event.stopPropagation()
                setSearchQuery('')
              }}
              placeholder="Search history"
              className="sidebar-search-input"
              aria-label="Search history"
            />
          </label>
          <NewThreadMenu
            currentBranch={currentBranch}
            dirtyMessage={dirtyWorktreeMessage}
            onAction={onAction}
            projectId={selectedProject.id}
          />
        </div>

        <div className="sidebar-work-thread-list">
          {visibleBranchGroups.length > 0 ? (
            visibleBranchGroups.map((group) => {
              const defaultCollapsed = !(group.current || group.id === selectedGroupId)
              const collapsed = normalizedSearchQuery
                ? false
                : (collapsedBranchIds[group.id] ?? defaultCollapsed)
              return (
                <BranchThreadGroupSection
                  key={group.id}
                  activeView={activeView}
                  collapsed={collapsed}
                  currentBranch={currentBranch}
                  group={group}
                  project={selectedProject}
                  selectedThreadId={selectedThreadId}
                  terminalRunningSessionPaths={terminalRunningSessionPaths}
                  onAction={onAction}
                  onThreadOpen={onThreadOpen}
                  onToggle={() =>
                    setCollapsedBranchIds((current) => ({
                      ...current,
                      [group.id]: !collapsed,
                    }))
                  }
                  pruneConfirmBranchId={pruneConfirmBranchId}
                  onSetPruneConfirmBranchId={setPruneConfirmBranchId}
                  switchErrorBranchId={switchErrorBranchId}
                  onSetSwitchErrorBranchId={setSwitchErrorBranchId}
                />
              )
            })
          ) : (
            <div className="sidebar-work-start-card">
              <span>No active threads for this work context.</span>
              <button
                type="button"
                onClick={() =>
                  void createThreadForBranch({
                    branchName: currentBranch,
                    onAction,
                    projectId: selectedProject.id,
                  })
                }
              >
                Start one
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="sidebar-work-history">
        <button type="button" className="sidebar-work-history-row" onClick={onOpenArchivedThreads}>
          <Archive size={14} />
          <span>Older threads</span>
          <span className={cn(appTypeMetaClass, appToneSubtleClass)}>
            {olderThreads.length > 0 ? olderThreads.length : threadCount}
          </span>
        </button>
      </div>
    </section>
  )
}
