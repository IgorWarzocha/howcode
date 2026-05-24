import { GitHubInvertocatMark } from '@howcode/common/github-invertocat-mark'
import { IconButton } from '@howcode/common/icon-button'
import { Tooltip } from '@howcode/common/tooltip'
import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { useQueries } from '@tanstack/react-query'
import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  FolderCode,
  FolderOpen,
  GitBranch,
  GitFork,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import {
  forwardRef,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useHowcodeKeybindingCommand } from '../../app-shell/keybinding-events'
import type { AppSettings, DesktopActionInvoker, ProjectGitState } from '../../desktop/types'
import { useDismissibleLayer } from '../../hooks/useDismissibleLayer'
import { desktopQueryKeys, getProjectGitStateQuery } from '../../query/desktop-query'
import type { Project, Thread, View } from '../../types'
import { appToneSubtleClass, appTypeMetaClass } from '../../ui/classes'
import { cn } from '../../utils/cn'
import { ThreadRow } from './project-tree/thread-row'
import { SidebarProjectsCreatePopover } from './projects/sidebar-projects-create-popover'
import { useSidebarProjectCreation } from './projects/useSidebarProjectCreation'
import { SidebarProjectsSkeleton } from './sidebar-skeletons'

const OLD_THREAD_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000
const UNASSIGNED_BRANCH_GROUP_ID = '__unassigned__'
function sameStringList(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function getProjectScopeLabel({
  selectedProject,
  visibleProjects,
}: {
  selectedProject: Project | null
  visibleProjects: readonly Project[]
}) {
  if (visibleProjects.length === 0) return 'No projects selected'
  const primaryVisibleProject =
    visibleProjects.find((project) => project.id === selectedProject?.id) ?? visibleProjects[0]
  const primaryProjectName = primaryVisibleProject?.name ?? selectedProject?.name ?? 'Projects'
  return visibleProjects.length > 1
    ? `${primaryProjectName} +${visibleProjects.length - 1}`
    : primaryProjectName
}

function getDisplayableProjects(projects: readonly Project[]) {
  return projects.filter(
    (project) => project.id.trim().length > 0 && project.name.trim().length > 0,
  )
}

function orderProjectsForScopeSelector(projects: readonly Project[], visibleProjectIds: string[]) {
  const visibleIndexById = new Map(visibleProjectIds.map((projectId, index) => [projectId, index]))
  return [...projects].sort((left, right) => {
    const leftIndex = visibleIndexById.get(left.id)
    const rightIndex = visibleIndexById.get(right.id)
    if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex
    if (leftIndex !== undefined) return -1
    if (rightIndex !== undefined) return 1
    return 0
  })
}

function projectBlockMatchesSearch(input: {
  branchThreads: Thread[]
  currentBranch: string | null
  normalizedSearchQuery: string
  projectName: string
  unassignedThreads: Thread[]
}) {
  if (input.normalizedSearchQuery.length === 0) return true
  return (
    input.projectName.toLowerCase().includes(input.normalizedSearchQuery) ||
    (input.currentBranch?.toLowerCase().includes(input.normalizedSearchQuery) ?? false) ||
    input.branchThreads.length > 0 ||
    input.unassignedThreads.length > 0
  )
}

type WorkSidebarSectionProps = {
  activeView: View
  loading: boolean
  projects: Project[]
  projectGitState: ProjectGitState | null
  initialVisibleProjectIds: string[] | null | undefined
  selectedProjectId: string
  selectedThreadId: string | null
  projectTargetMode?: boolean | undefined
  projectScopeLockActive?: boolean | undefined
  terminalRunningProjectIds: ReadonlySet<string>
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
}

function ProjectInstallTargetList({
  projects,
  selectedProjectId,
  terminalRunningProjectIds,
  onAction,
  onProjectPrimeSelection,
  onProjectTargetSelected,
}: {
  projects: Project[]
  selectedProjectId: string
  terminalRunningProjectIds: ReadonlySet<string>
  onAction: DesktopActionInvoker
  onProjectPrimeSelection: (projectId: string) => void
  onProjectTargetSelected?: (() => void) | undefined
}) {
  return (
    <div className="sidebar-work-lane sidebar-work-install-targets">
      <div className="sidebar-work-install-target-copy">Choose install target</div>
      <div className="sidebar-work-install-target-scroll-shell">
        <div className="sidebar-work-project-list sidebar-work-install-target-list">
          {projects.map((project) => {
            const selected = project.id === selectedProjectId
            return (
              <button
                key={project.id}
                type="button"
                className="sidebar-work-project-option"
                data-active={selected ? 'true' : 'false'}
                aria-current={selected ? 'true' : undefined}
                onClick={() => {
                  onProjectPrimeSelection(project.id)
                  window.dispatchEvent(new CustomEvent('howcode:project-target-selected'))
                  onProjectTargetSelected?.()
                  void onAction('project.select', { projectId: project.id })
                }}
              >
                <span
                  className="sidebar-work-project-scope-toggle"
                  data-checked={selected ? 'true' : 'false'}
                  aria-hidden="true"
                >
                  {selected ? <Check size={11} /> : null}
                </span>
                <span className="sidebar-work-project-focus">
                  {project.repoOriginUrl ? (
                    <GitHubInvertocatMark size={13} />
                  ) : (
                    <FolderCode size={13} />
                  )}
                  <span className="truncate">{project.name}</span>
                </span>
                {terminalRunningProjectIds.has(project.id) ? (
                  <span
                    className="sidebar-work-live-dot"
                    title="Running terminal"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function getVisibleProjectIds(
  storedVisibleProjectIds: string[] | null,
  initialVisibleProjectIds: string[] | null | undefined,
  selectedProject: Project | null,
) {
  if (storedVisibleProjectIds) return storedVisibleProjectIds
  if (initialVisibleProjectIds) return initialVisibleProjectIds
  if (storedVisibleProjectIds === null && initialVisibleProjectIds === null) {
    return selectedProject ? [selectedProject.id] : []
  }
  return []
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

function ProjectScopeOptionRow({
  focused,
  project,
  running,
  visible,
  onToggleVisible,
}: {
  focused: boolean
  project: Project
  running: boolean
  visible: boolean
  onToggleVisible: () => void
}) {
  return (
    <div className="sidebar-work-project-option" data-active={focused ? 'true' : 'false'}>
      <button
        type="button"
        className="sidebar-work-project-scope-toggle"
        data-checked={visible ? 'true' : 'false'}
        onClick={(event) => {
          event.stopPropagation()
          onToggleVisible()
        }}
        aria-label={visible ? `Hide ${project.name} in sidebar` : `Show ${project.name} in sidebar`}
      >
        {visible ? <Check size={11} /> : null}
      </button>
      <button type="button" className="sidebar-work-project-focus" onClick={onToggleVisible}>
        {project.repoOriginUrl ? <GitHubInvertocatMark size={13} /> : <FolderCode size={13} />}
        <span className="truncate">{project.name}</span>
      </button>
      {running ? (
        <span className="sidebar-work-live-dot" title="Running terminal" aria-hidden="true" />
      ) : null}
    </div>
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
      onDelete={() =>
        onAction('thread.delete', {
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

function getProjectGitStateForSidebar(
  projectId: string,
  projectGitState: ProjectGitState | null,
  gitStatesByProjectId: ReadonlyMap<string, ProjectGitState | null>,
) {
  if (projectGitState?.projectId === projectId) return projectGitState
  return gitStatesByProjectId.get(projectId) ?? null
}

function getCurrentBranchForProject(
  project: Project,
  projectGitState: ProjectGitState | null,
  gitStatesByProjectId: ReadonlyMap<string, ProjectGitState | null>,
) {
  const gitState = getProjectGitStateForSidebar(project.id, projectGitState, gitStatesByProjectId)
  return gitState?.isGitRepo ? gitState.branch : null
}

function getRepositoryBranchesForProject(
  project: Project,
  projectGitState: ProjectGitState | null,
  gitStatesByProjectId: ReadonlyMap<string, ProjectGitState | null>,
) {
  const gitState = getProjectGitStateForSidebar(project.id, projectGitState, gitStatesByProjectId)
  return gitState?.isGitRepo ? gitState.branches : []
}

function filterThreadsForCurrentBranch(threads: readonly Thread[], currentBranch: string | null) {
  if (!currentBranch) return []
  return sortThreads(threads.filter((thread) => thread.branchName === currentBranch))
}

function filterThreadsBySearch(threads: readonly Thread[], searchQuery: string) {
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  if (!normalizedSearchQuery) return [...threads]
  return threads.filter((thread) =>
    [thread.title, thread.summary ?? '', thread.branchName ?? '']
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearchQuery),
  )
}

function ProjectExpandedBranchGroups({
  activeView,
  branchGroups,
  collapsedBranchIds,
  currentBranch,
  normalizedSearchQuery,
  project,
  pruneConfirmBranchId,
  selectedThreadId,
  switchErrorBranchId,
  terminalRunningSessionPaths,
  onAction,
  onSetCollapsedBranchIds,
  onSetPruneConfirmBranchId,
  onSetSwitchErrorBranchId,
  onThreadOpen,
}: {
  activeView: View
  branchGroups: BranchThreadGroup[]
  collapsedBranchIds: Record<string, boolean>
  currentBranch: string | null
  normalizedSearchQuery: string
  project: Project
  pruneConfirmBranchId: string | null
  selectedThreadId: string | null
  switchErrorBranchId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  onAction: DesktopActionInvoker
  onSetCollapsedBranchIds: (
    updater: (current: Record<string, boolean>) => Record<string, boolean>,
  ) => void
  onSetPruneConfirmBranchId: (branchId: string | null) => void
  onSetSwitchErrorBranchId: (branchId: string | null) => void
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
}) {
  return (
    <div className="sidebar-work-project-expanded-branches">
      {branchGroups.map((group) => {
        const groupKey = `${project.id}:${group.id}`
        const defaultCollapsed = !group.current
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
  )
}

function ProjectCompactBranchGroups({
  activeView,
  branchThreads,
  currentBranch,
  currentBranchExpanded,
  project,
  selectedThreadId,
  terminalRunningSessionPaths,
  unassignedExpanded,
  unassignedThreads,
  onAction,
  onToggleCurrentBranch,
  onThreadOpen,
  onToggleUnassigned,
}: {
  activeView: View
  branchThreads: Thread[]
  currentBranch: string | null
  currentBranchExpanded: boolean
  project: Project
  selectedThreadId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  unassignedExpanded: boolean
  unassignedThreads: Thread[]
  onAction: DesktopActionInvoker
  onToggleCurrentBranch: () => void
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
  onToggleUnassigned: () => void
}) {
  return (
    <>
      <section className="sidebar-work-branch-group" data-current="true">
        <div className="sidebar-work-branch-heading">
          <button
            type="button"
            className="sidebar-work-branch-disclosure"
            onClick={onToggleCurrentBranch}
            aria-expanded={currentBranchExpanded}
            aria-label={currentBranchExpanded ? 'Collapse current branch' : 'Expand current branch'}
          >
            {currentBranchExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          <button
            type="button"
            className="sidebar-work-branch-toggle"
            onClick={onToggleCurrentBranch}
            aria-expanded={currentBranchExpanded}
          >
            <GitBranch size={13} className="sidebar-work-branch-icon" />
            <span className="truncate">{currentBranch ?? 'No branch'}</span>
          </button>
          <span className="sidebar-work-branch-meta">
            <span className="sidebar-work-branch-count">{branchThreads.length}</span>
          </span>
        </div>
        {currentBranchExpanded ? (
          <div className="sidebar-work-branch-thread-list">
            {branchThreads.length > 0 ? (
              branchThreads.map((thread) => (
                <WorkThreadRow
                  key={thread.id}
                  activeView={activeView}
                  currentBranch={currentBranch}
                  project={project}
                  selectedThreadId={selectedThreadId}
                  terminalRunningSessionPaths={terminalRunningSessionPaths}
                  thread={thread}
                  onAction={onAction}
                  onThreadOpen={onThreadOpen}
                />
              ))
            ) : (
              <div className="sidebar-work-branch-empty">No threads on current branch.</div>
            )}
          </div>
        ) : null}
      </section>

      {unassignedThreads.length > 0 ? (
        <section className="sidebar-work-branch-group">
          <div className="sidebar-work-branch-heading">
            <button
              type="button"
              className="sidebar-work-branch-disclosure"
              onClick={onToggleUnassigned}
              aria-expanded={unassignedExpanded}
              aria-label={
                unassignedExpanded ? 'Collapse unassigned sessions' : 'Expand unassigned sessions'
              }
            >
              {unassignedExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
            <button
              type="button"
              className="sidebar-work-branch-toggle sidebar-work-branch-toggle--plain"
              onClick={onToggleUnassigned}
              aria-expanded={unassignedExpanded}
            >
              <span className="truncate">Unassigned</span>
            </button>
            <span className="sidebar-work-branch-meta">
              <span className="sidebar-work-branch-count">{unassignedThreads.length}</span>
            </span>
          </div>
          {unassignedExpanded ? (
            <div className="sidebar-work-branch-thread-list">
              {unassignedThreads.map((thread) => (
                <WorkThreadRow
                  key={thread.id}
                  activeView={activeView}
                  currentBranch={currentBranch}
                  project={project}
                  selectedThreadId={selectedThreadId}
                  terminalRunningSessionPaths={terminalRunningSessionPaths}
                  thread={thread}
                  onAction={onAction}
                  onThreadOpen={onThreadOpen}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  )
}

function ProjectWorkBlockHeader({
  currentBranch,
  dirtyMessage,
  expanded,
  project,
  onAction,
  onFocusProject,
  onToggleExpanded,
}: {
  currentBranch: string | null
  dirtyMessage: string | null
  expanded: boolean
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
    const row = anchor.closest('.sidebar-work-project-block-heading-row')
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
    <div className="sidebar-work-project-block-heading-row">
      <button
        type="button"
        className="sidebar-work-project-block-disclosure"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
        aria-label={expanded ? `Collapse ${project.name}` : `Expand ${project.name}`}
      >
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>
      <button
        type="button"
        className="sidebar-work-project-block-heading"
        onClick={() => onFocusProject(project.id)}
      >
        {project.repoOriginUrl ? <GitHubInvertocatMark size={13} /> : <FolderCode size={13} />}
        {editingName ? (
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
        ) : (
          <span className="truncate">{project.name}</span>
        )}
      </button>
      <div className="sidebar-work-project-menu-anchor">
        <IconButton
          ref={menuButtonRef}
          label="Project actions"
          icon={<MoreHorizontal size={13} />}
          tooltipPlacement="right"
          className="sidebar-work-project-menu-button h-7 w-7 rounded-md"
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
        dirtyMessage={dirtyMessage}
        onAction={onAction}
        projectId={project.id}
      />
    </div>
  )
}

function ProjectWorkSummaryBlock({
  activeView,
  branchGroups,
  collapsedBranchIds,
  currentBranch,
  dirtyMessage,
  expanded,
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
  dirtyMessage: string | null
  expanded: boolean
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
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const branchThreads = filterThreadsBySearch(
    filterThreadsForCurrentBranch(threads, currentBranch),
    searchQuery,
  )
  const unassignedThreads = filterThreadsBySearch(
    sortThreads(threads.filter((thread) => !thread.branchName?.trim())),
    searchQuery,
  )
  const unassignedExpanded = normalizedSearchQuery.length > 0 || !unassignedCollapsed

  if (
    !projectBlockMatchesSearch({
      branchThreads,
      currentBranch,
      normalizedSearchQuery,
      projectName: project.name,
      unassignedThreads,
    })
  )
    return null

  return (
    <section className="sidebar-work-project-block">
      <ProjectWorkBlockHeader
        currentBranch={currentBranch}
        dirtyMessage={dirtyMessage}
        expanded={expanded}
        project={project}
        onAction={onAction}
        onFocusProject={onFocusProject}
        onToggleExpanded={onToggleExpanded}
      />

      <div className="sidebar-work-project-block-actions">
        <button
          type="button"
          className="sidebar-work-action-row"
          data-active={activeView === 'automations' && isProjectActive ? 'true' : 'false'}
          onClick={() => {
            onFocusProject(project.id)
            onShowView('automations')
          }}
        >
          <ChevronRight size={13} aria-hidden="true" />
          <span>Automations</span>
          <span className="sidebar-work-pill">Soon</span>
        </button>
        {expanded ? (
          <button
            type="button"
            className="sidebar-work-history-row"
            data-active={
              activeView === 'sessions' && isProjectActive && selectedThreadId === null
                ? 'true'
                : 'false'
            }
            onClick={openProjectSessions}
          >
            <Archive size={14} />
            <span>Past sessions</span>
            <span className={cn(appTypeMetaClass, appToneSubtleClass)}>{olderThreadCount}</span>
          </button>
        ) : null}
      </div>

      {expanded ? (
        <ProjectExpandedBranchGroups
          activeView={activeView}
          branchGroups={branchGroups}
          collapsedBranchIds={collapsedBranchIds}
          currentBranch={currentBranch}
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
          currentBranch={currentBranch}
          currentBranchExpanded={
            normalizedSearchQuery.length > 0 ||
            !(collapsedBranchIds[`${project.id}:current-branch`] ?? false)
          }
          project={project}
          selectedThreadId={selectedThreadId}
          terminalRunningSessionPaths={terminalRunningSessionPaths}
          unassignedExpanded={unassignedExpanded}
          unassignedThreads={unassignedThreads}
          onAction={onAction}
          onThreadOpen={onThreadOpen}
          onToggleCurrentBranch={() =>
            onSetCollapsedBranchIds((current) => ({
              ...current,
              [`${project.id}:current-branch`]: !(current[`${project.id}:current-branch`] ?? false),
            }))
          }
          onToggleUnassigned={onToggleUnassigned}
        />
      )}
    </section>
  )
}

function SearchHistoryField({
  inputRef,
  searchQuery,
  onSearchQueryChange,
}: {
  inputRef?: RefObject<HTMLInputElement | null>
  searchQuery: string
  onSearchQueryChange: (query: string) => void
}) {
  return (
    <label
      className="sidebar-search-field sidebar-work-search-field"
      data-active={searchQuery.trim().length > 0 ? 'true' : 'false'}
    >
      <Search size={14} className="sidebar-search-icon" />
      <input
        ref={inputRef}
        value={searchQuery}
        onChange={(event) => onSearchQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || searchQuery.length === 0) return
          event.stopPropagation()
          onSearchQueryChange('')
        }}
        placeholder="Search history"
        className="sidebar-search-input"
        aria-label="Search history"
      />
    </label>
  )
}

function ProjectRenameField({
  projectName,
  renameDraft,
  onCancel,
  onChange,
  onSubmit,
}: {
  projectName: string
  renameDraft: string
  onCancel: () => void
  onChange: (value: string) => void
  onSubmit: () => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  return (
    <input
      ref={inputRef}
      className="sidebar-work-project-rename-input"
      value={renameDraft}
      onBlur={onSubmit}
      onChange={(event) => onChange(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onSubmit()
        if (event.key === 'Escape') {
          event.stopPropagation()
          onCancel()
        }
      }}
      aria-label={`Rename ${projectName}`}
    />
  )
}

const ProjectWorkActionsMenu = forwardRef<
  HTMLDivElement,
  {
    project: Project
    right: number
    width: number
    onAction: DesktopActionInvoker
    onClose: () => void
    onRename: () => void
  }
>(function ProjectWorkActionsMenuPanel(
  { project, right, width, onAction, onClose, onRename },
  ref,
) {
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const runProjectAction = (action: 'project.open-in-file-manager' | 'project.remove-project') => {
    void onAction(action, { projectId: project.id, projectName: project.name })
    onClose()
  }

  return (
    <div
      ref={ref}
      className="sidebar-work-project-actions-menu"
      style={{ right: `${right}px`, width: `${width}px` }}
      role="menu"
    >
      <button
        type="button"
        className="sidebar-work-project-actions-menu-item"
        onClick={onRename}
        role="menuitem"
      >
        <Pencil size={12} />
        <span>Rename</span>
      </button>
      <button
        type="button"
        className="sidebar-work-project-actions-menu-item"
        onClick={() => runProjectAction('project.open-in-file-manager')}
        role="menuitem"
      >
        <FolderOpen size={12} />
        <span>Reveal in file manager</span>
      </button>
      <button
        type="button"
        className="sidebar-work-project-actions-menu-item"
        data-danger="true"
        onClick={() => {
          if (!deleteConfirm) {
            setDeleteConfirm(true)
            return
          }
          runProjectAction('project.remove-project')
        }}
        role="menuitem"
      >
        <Trash2 size={12} />
        <span>{deleteConfirm ? 'Click to confirm' : 'Delete project'}</span>
      </button>
    </div>
  )
})

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
        className="h-7 w-7 translate-x-0.5 rounded-md"
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

function ProjectScopeSelector({
  appSettings,
  label,
  open,
  projects,
  scopeProject,
  selectedProject,
  terminalRunningProjectIds,
  visibleProjects,
  onAction,
  onOpenChange,
  onOpenSettingsPanel,
  onToggleVisibleProject,
}: {
  appSettings: AppSettings
  label: string
  open: boolean
  projects: Project[]
  scopeProject: Project | null
  selectedProject: Project | null
  terminalRunningProjectIds: ReadonlySet<string>
  visibleProjects: Project[]
  onAction: DesktopActionInvoker
  onOpenChange: (open: boolean) => void
  onOpenSettingsPanel: (target?: SettingsOpenTarget) => void
  onToggleVisibleProject: (projectId: string) => void
}) {
  const selectorRef = useRef<HTMLDivElement | null>(null)
  const createButtonRef = useRef<HTMLButtonElement>(null)
  const createPanelRef = useRef<HTMLDialogElement>(null)
  const [projectSearchQuery, setProjectSearchQuery] = useState('')
  const {
    createBusy,
    createErrorMessage,
    createOpen,
    handleAddFolderProject,
    handleCreateProject,
    projectNameDraft,
    setCreateErrorMessage,
    setCreateOpen,
    setProjectNameDraft,
  } = useSidebarProjectCreation({ appSettings, onAction, onOpenSettingsPanel })
  const normalizedProjectSearch = projectSearchQuery.trim().toLowerCase()
  const visibleProjectIds = useMemo(
    () => new Set(visibleProjects.map((project) => project.id)),
    [visibleProjects],
  )
  const filteredProjects = useMemo(() => {
    if (!normalizedProjectSearch) return projects
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(normalizedProjectSearch) ||
        project.id.toLowerCase().includes(normalizedProjectSearch),
    )
  }, [normalizedProjectSearch, projects])

  const closeCreatePopover = () => {
    setCreateOpen(false)
    setCreateErrorMessage(null)
  }
  const dismissSelector = () => {
    closeCreatePopover()
    onOpenChange(false)
  }
  useDismissibleLayer({
    open: open || createOpen,
    onDismiss: dismissSelector,
    refs: [selectorRef, createPanelRef],
  })

  return (
    <div ref={selectorRef} className="sidebar-work-project-card">
      <div className="sidebar-work-project-header-row">
        <div className="sidebar-work-project-kicker">Projects</div>
        <IconButton
          ref={createButtonRef}
          label="Add project"
          icon={<Plus size={13} />}
          tooltipPlacement="right"
          className="sidebar-work-project-create-button h-7 w-7 -translate-x-0.5 rounded-md"
          onClick={() => {
            if (open) onOpenChange(false)
            setCreateOpen(!createOpen)
          }}
        />
      </div>
      <button
        type="button"
        className="sidebar-work-project-button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
      >
        <span className="truncate">{label}</span>
        <span className="sidebar-work-project-button-meta">
          {scopeProject?.repoOriginUrl ? <GitHubInvertocatMark size={13} /> : null}
          <ChevronDown size={13} />
        </span>
      </button>
      {open ? (
        <div className="sidebar-work-project-list">
          <label
            className="sidebar-search-field sidebar-work-project-search-field"
            data-active={projectSearchQuery.trim().length > 0 ? 'true' : 'false'}
          >
            <Search size={14} className="sidebar-search-icon" />
            <input
              value={projectSearchQuery}
              onChange={(event) => setProjectSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Escape' || projectSearchQuery.length === 0) return
                event.stopPropagation()
                setProjectSearchQuery('')
              }}
              placeholder="Search projects"
              className="sidebar-search-input"
              aria-label="Search projects"
            />
          </label>
          {filteredProjects.map((project) => (
            <ProjectScopeOptionRow
              key={project.id}
              project={project}
              focused={project.id === selectedProject?.id}
              visible={visibleProjectIds.has(project.id)}
              running={terminalRunningProjectIds.has(project.id)}
              onToggleVisible={() => onToggleVisibleProject(project.id)}
            />
          ))}
          {filteredProjects.length === 0 ? (
            <div className="sidebar-work-project-empty">No matching projects</div>
          ) : null}
        </div>
      ) : null}
      <SidebarProjectsCreatePopover
        menuId="sidebar-work-project-create"
        open={createOpen}
        variant="work-sidebar"
        draft={projectNameDraft}
        defaultLocation={appSettings.preferredProjectLocation ?? null}
        busy={createBusy}
        errorMessage={createErrorMessage}
        panelRef={createPanelRef}
        onChangeDraft={setProjectNameDraft}
        onCreate={handleCreateProject}
        onAddFolder={handleAddFolderProject}
        onClose={closeCreatePopover}
      />
    </div>
  )
}

function MultiProjectWorkContent({
  activeView,
  collapsedBranchIds,
  gitStatesByProjectId,
  projectGitState,
  searchInputRef,
  searchQuery,
  selectedProjectId,
  selectedThreadId,
  terminalRunningSessionPaths,
  visibleProjects,
  onAction,
  onFocusProject,
  onPrimeProject,
  onSearchQueryChange,
  onSetCollapsedBranchIds,
  onSetExpandedProjectIds,
  onSetPruneConfirmBranchId,
  onSetSwitchErrorBranchId,
  pruneConfirmBranchId,
  switchErrorBranchId,
  onShowView,
  onThreadOpen,
}: {
  activeView: View
  collapsedBranchIds: Record<string, boolean>
  gitStatesByProjectId: ReadonlyMap<string, ProjectGitState | null>
  projectGitState: ProjectGitState | null
  searchInputRef: RefObject<HTMLInputElement | null>
  searchQuery: string
  selectedProjectId: string
  selectedThreadId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  visibleProjects: Project[]
  onAction: DesktopActionInvoker
  onFocusProject: (projectId: string) => void
  onPrimeProject: (projectId: string) => void
  onSearchQueryChange: (query: string) => void
  onSetCollapsedBranchIds: (
    updater: (current: Record<string, boolean>) => Record<string, boolean>,
  ) => void
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
    <div className="sidebar-work-lane">
      <div className="sidebar-work-section-heading sidebar-work-section-heading--search-only">
        <SearchHistoryField
          inputRef={searchInputRef}
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
        />
      </div>
      <div className="sidebar-work-scroll-shell">
        <div className="sidebar-work-thread-list sidebar-work-project-block-list">
          {visibleProjects.map((project) => {
            const buckets = bucketThreads(project, selectedThreadId)
            const blockCurrentBranch = getCurrentBranchForProject(
              project,
              projectGitState,
              gitStatesByProjectId,
            )
            const dirtyMessage = getDirtyWorktreeMessage(
              getProjectGitStateForSidebar(project.id, projectGitState, gitStatesByProjectId),
              project.id,
            )
            const repositoryBranches = getRepositoryBranchesForProject(
              project,
              projectGitState,
              gitStatesByProjectId,
            )
            const branchGroups = buildBranchGroups(
              buckets.activeThreads,
              blockCurrentBranch,
              repositoryBranches,
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
                dirtyMessage={dirtyMessage}
                expanded={expanded}
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
                onToggleExpanded={() =>
                  onSetExpandedProjectIds((current) => ({
                    ...current,
                    [`project:${project.id}`]: expanded,
                  }))
                }
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

function SingleProjectWorkContent({
  activeView,
  branchGroups,
  collapsedBranchIds,
  currentBranch,
  dirtyWorktreeMessage,
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
  dirtyWorktreeMessage: string | null
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
      <div className="sidebar-work-actions">
        <button
          type="button"
          className="sidebar-work-action-row"
          data-active={activeView === 'automations' ? 'true' : 'false'}
          onClick={() => onShowView('automations')}
        >
          <ChevronRight size={13} aria-hidden="true" />
          <span>Automations</span>
          <span className="sidebar-work-pill">Soon</span>
        </button>
        <button
          type="button"
          className="sidebar-work-history-row"
          data-active={activeView === 'sessions' && selectedThreadId === null ? 'true' : 'false'}
          onClick={() => onShowView('sessions')}
        >
          <Archive size={14} />
          <span>Past sessions</span>
          <span className={cn(appTypeMetaClass, appToneSubtleClass)}>{olderThreadCount}</span>
        </button>
      </div>

      <div className="sidebar-work-lane">
        <div className="sidebar-work-section-heading">
          <SearchHistoryField
            inputRef={searchInputRef}
            searchQuery={searchQuery}
            onSearchQueryChange={onSearchQueryChange}
          />
          <NewThreadMenu
            currentBranch={currentBranch}
            dirtyMessage={dirtyWorktreeMessage}
            onAction={onAction}
            projectId={project.id}
          />
        </div>

        <div className="sidebar-work-scroll-shell">
          <div className="sidebar-work-thread-list">
            {branchGroups.length > 0 ? (
              branchGroups.map((group) => {
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
                    project={project}
                    selectedThreadId={selectedThreadId}
                    terminalRunningSessionPaths={terminalRunningSessionPaths}
                    onAction={onAction}
                    onThreadOpen={onThreadOpen}
                    onToggle={() =>
                      onSetCollapsedBranchIds((current) => ({
                        ...current,
                        [group.id]: !collapsed,
                      }))
                    }
                    pruneConfirmBranchId={pruneConfirmBranchId}
                    onSetPruneConfirmBranchId={onSetPruneConfirmBranchId}
                    switchErrorBranchId={switchErrorBranchId}
                    onSetSwitchErrorBranchId={onSetSwitchErrorBranchId}
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
                      projectId: project.id,
                    })
                  }
                >
                  Start one
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export function WorkSidebarSection({
  activeView,
  appSettings,
  loading,
  projects,
  projectGitState,
  projectTargetMode = false,
  initialVisibleProjectIds,
  selectedProjectId,
  selectedThreadId,
  terminalRunningProjectIds,
  terminalRunningSessionPaths,
  onAction,
  onLoadProjectThreads,
  onOpenSettingsPanel,
  onProjectSelect,
  onProjectPrimeSelection,
  onProjectTargetSelected,
  onThreadOpen,
  onShowView,
}: WorkSidebarSectionProps) {
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedBranchIds, setCollapsedBranchIds] = useState<Record<string, boolean>>({})
  const [pruneConfirmBranchId, setPruneConfirmBranchId] = useState<string | null>(null)
  const [switchErrorBranchId, setSwitchErrorBranchId] = useState<string | null>(null)
  const [storedVisibleProjectIds, setStoredVisibleProjectIds] = useState<string[] | null>(null)
  const [scopeSelectorOrderIds, setScopeSelectorOrderIds] = useState<string[] | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const appliedInitialEmptyScopeRef = useRef(false)
  const displayableProjects = useMemo(() => getDisplayableProjects(projects), [projects])
  const selectedProject =
    displayableProjects.find((project) => project.id === selectedProjectId) ??
    displayableProjects[0] ??
    null
  const visibleProjectIds = getVisibleProjectIds(
    storedVisibleProjectIds,
    initialVisibleProjectIds,
    selectedProject,
  )
  useEffect(() => {
    if (appliedInitialEmptyScopeRef.current || initialVisibleProjectIds === undefined) return
    appliedInitialEmptyScopeRef.current = true
    if (initialVisibleProjectIds === null || initialVisibleProjectIds.length > 0) return
    onShowView('landing')
  }, [initialVisibleProjectIds, onShowView])

  useEffect(() => {
    if (initialVisibleProjectIds === undefined) return
    setStoredVisibleProjectIds((current) => current ?? initialVisibleProjectIds)
  }, [initialVisibleProjectIds])

  useEffect(() => {
    if (!storedVisibleProjectIds) return
    setStoredVisibleProjectIds((current) => {
      if (!current) return current
      const validProjectIds = new Set(displayableProjects.map((project) => project.id))
      const nextProjectIds = current.filter((projectId) => validProjectIds.has(projectId))
      return sameStringList(current, nextProjectIds) ? current : nextProjectIds
    })
  }, [displayableProjects, storedVisibleProjectIds])

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
      '.sidebar-work-section .sidebar-thread-row[data-selected="true"]',
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

  useEffect(() => {
    for (const project of visibleProjects) {
      if (project.threadsLoaded) continue
      void onLoadProjectThreads(project.id, { chat: false })
    }
  }, [onLoadProjectThreads, visibleProjects])

  const focusProject = (projectId: string) => {
    onProjectSelect(projectId)
    void onAction('project.select', { projectId })
  }
  const primeProject = (projectId: string) => {
    onProjectPrimeSelection(projectId)
    void onAction('project.select', { projectId })
  }
  const toggleVisibleProject = (projectId: string) => {
    const wasVisible = visibleProjectIds.includes(projectId)
    const nextProjectIds = wasVisible
      ? visibleProjectIds.filter((id) => id !== projectId)
      : [...visibleProjectIds, projectId]
    setStoredVisibleProjectIds(nextProjectIds)
    if (!wasVisible && visibleProjectIds.length === 0) {
      focusProject(projectId)
    } else if (nextProjectIds.length === 0) {
      onShowView('landing')
    }
  }

  if (loading && displayableProjects.length === 0) return <SidebarProjectsSkeleton />

  if (!selectedProject && displayableProjects.length === 0) {
    return (
      <section className="sidebar-work-section" aria-label="Work">
        <ProjectScopeSelector
          appSettings={appSettings}
          label="No projects yet"
          open={projectSwitcherOpen}
          projects={scopeSelectorProjects}
          scopeProject={null}
          selectedProject={null}
          terminalRunningProjectIds={terminalRunningProjectIds}
          visibleProjects={visibleProjects}
          onAction={onAction}
          onOpenChange={setProjectSwitcherOpen}
          onOpenSettingsPanel={onOpenSettingsPanel}
          onToggleVisibleProject={toggleVisibleProject}
        />
        <div className="sidebar-work-empty">
          <FolderCode size={18} />
          <span>Add a project to get started</span>
        </div>
      </section>
    )
  }

  if (projectTargetMode) {
    return (
      <section className="sidebar-work-section" aria-label="Project install target">
        <ProjectInstallTargetList
          projects={displayableProjects}
          selectedProjectId={selectedProjectId}
          terminalRunningProjectIds={terminalRunningProjectIds}
          onAction={onAction}
          onProjectPrimeSelection={onProjectPrimeSelection}
          onProjectTargetSelected={onProjectTargetSelected}
        />
      </section>
    )
  }

  if (!selectedProject) return null

  const { activeThreads, olderThreads } = bucketThreads(selectedProject, selectedThreadId)
  const currentBranch = getCurrentBranchForProject(
    selectedProject,
    projectGitState,
    gitStatesByProjectId,
  )
  const repositoryBranches = getRepositoryBranchesForProject(
    selectedProject,
    projectGitState,
    gitStatesByProjectId,
  )
  const branchGroups = buildBranchGroups(activeThreads, currentBranch, repositoryBranches)
  const dirtyWorktreeMessage = getDirtyWorktreeMessage(
    getProjectGitStateForSidebar(selectedProject.id, projectGitState, gitStatesByProjectId),
    selectedProject.id,
  )
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const visibleBranchGroups = filterBranchGroups(branchGroups, searchQuery)
  const selectedThread = selectedProject.threads.find((thread) => thread.id === selectedThreadId)
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
    <section className="sidebar-work-section" aria-label="Project work">
      <ProjectScopeSelector
        appSettings={appSettings}
        label={projectScopeLabel}
        open={projectSwitcherOpen}
        projects={scopeSelectorProjects}
        scopeProject={scopeProject}
        selectedProject={selectedProject}
        terminalRunningProjectIds={terminalRunningProjectIds}
        visibleProjects={visibleProjects}
        onAction={onAction}
        onOpenChange={setProjectSwitcherOpenState}
        onOpenSettingsPanel={onOpenSettingsPanel}
        onToggleVisibleProject={toggleVisibleProject}
      />

      {visibleProjects.length === 0 ? (
        <div className="sidebar-work-empty sidebar-work-scope-empty">
          <FolderCode size={18} />
          <span>No projects selected.</span>
          <span>Choose projects from the selector above.</span>
        </div>
      ) : multiProjectMode ? (
        <MultiProjectWorkContent
          activeView={activeView}
          collapsedBranchIds={collapsedBranchIds}
          gitStatesByProjectId={gitStatesByProjectId}
          projectGitState={projectGitState}
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          selectedProjectId={selectedProjectId}
          selectedThreadId={selectedThreadId}
          terminalRunningSessionPaths={terminalRunningSessionPaths}
          visibleProjects={visibleProjects}
          onAction={onAction}
          onFocusProject={focusProject}
          onPrimeProject={primeProject}
          onSearchQueryChange={setSearchQuery}
          onSetCollapsedBranchIds={setCollapsedBranchIds}
          onSetExpandedProjectIds={setCollapsedBranchIds}
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
          dirtyWorktreeMessage={dirtyWorktreeMessage}
          normalizedSearchQuery={normalizedSearchQuery}
          olderThreadCount={olderThreads.length}
          project={selectedProject}
          pruneConfirmBranchId={pruneConfirmBranchId}
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          selectedGroupId={selectedGroupId}
          selectedThreadId={selectedThreadId}
          switchErrorBranchId={switchErrorBranchId}
          terminalRunningSessionPaths={terminalRunningSessionPaths}
          onAction={onAction}
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
