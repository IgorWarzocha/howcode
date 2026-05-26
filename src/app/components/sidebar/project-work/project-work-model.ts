import type { ProjectGitState } from '../../../desktop/types'
import type { Project, Thread } from '../../../types'

const OLD_THREAD_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000
const pathSeparatorPattern = /[\\/]/
export const UNASSIGNED_BRANCH_GROUP_ID = '__unassigned__'
export function sameStringList(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

export function getProjectScopeLabel({
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

export function getDisplayableProjects(projects: readonly Project[]) {
  return projects.filter(
    (project) => project.id.trim().length > 0 && project.name.trim().length > 0,
  )
}

export function orderProjectsForScopeSelector(
  projects: readonly Project[],
  visibleProjectIds: string[],
) {
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

export function projectBlockMatchesSearch(input: {
  branchGroups: BranchThreadGroup[]
  normalizedSearchQuery: string
  projectName: string
}) {
  if (input.normalizedSearchQuery.length === 0) return true
  return (
    input.projectName.toLowerCase().includes(input.normalizedSearchQuery) ||
    input.branchGroups.length > 0
  )
}

export function getVisibleProjectIds(
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

export type ThreadBuckets = {
  activeThreads: Thread[]
  olderThreads: Thread[]
}

export type BranchThreadGroup = {
  id: string
  label: string
  threads: Thread[]
  worktrees: WorktreeBranchGroup[]
  completedWorktrees?: WorktreeBranch[] | undefined
  current: boolean
  unassigned: boolean
  worktree: boolean
  worktreeComplete?: boolean | undefined
  worktreePath?: string | undefined
  worktreeBranchName?: string | undefined
}

export type WorktreeBranch = {
  label: string
  path: string
  branchName?: string | undefined
  complete?: boolean | undefined
}

export type WorktreeBranchGroup = WorktreeBranch & {
  id: string
  threads: Thread[]
}

type SidebarThread = Thread & {
  sidebarWorktreePath?: string | undefined
}

type GroupedSidebarThreads = {
  groupedThreads: Map<string, SidebarThread[]>
  groupedWorktreeThreads: Map<string, Map<string, SidebarThread[]>>
  unassignedThreads: SidebarThread[]
}

function buildWorktreesByBranch(worktreeBranches: readonly WorktreeBranch[]) {
  const worktreesByBranch = new Map<string, WorktreeBranch[]>()
  for (const worktreeBranch of worktreeBranches) {
    const branchName = (worktreeBranch.branchName ?? worktreeBranch.label).trim()
    if (!branchName) continue
    const worktrees = worktreesByBranch.get(branchName) ?? []
    worktrees.push(worktreeBranch)
    worktreesByBranch.set(branchName, worktrees)
  }
  return worktreesByBranch
}

function createBranchThreadGroup(input: {
  branchName: string
  current: boolean
  groupedThreads: ReadonlyMap<string, SidebarThread[]>
  groupedWorktreeThreads: ReadonlyMap<string, ReadonlyMap<string, SidebarThread[]>>
  worktreesByBranch: ReadonlyMap<string, readonly WorktreeBranch[]>
}): BranchThreadGroup {
  const branchWorktrees = input.worktreesByBranch.get(input.branchName) ?? []
  const worktreeThreadsByPath = input.groupedWorktreeThreads.get(input.branchName)
  const worktrees = branchWorktrees
    .map((worktree) => ({
      ...worktree,
      id: worktree.path,
      complete: Boolean(worktree.complete),
      threads: sortThreads([...(worktreeThreadsByPath?.get(worktree.path) ?? [])]),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const branchThreads = sortThreads(input.groupedThreads.get(input.branchName) ?? [])
  return {
    id: input.branchName,
    label: input.branchName,
    threads: branchThreads,
    worktrees,
    current: input.current,
    unassigned: false,
    worktree: false,
  }
}

function getThreadSortValue(thread: Thread) {
  return thread.lastModifiedMs ?? 0
}

export function sortThreads(threads: Thread[]) {
  return [...threads].sort((a, b) => getThreadSortValue(b) - getThreadSortValue(a))
}

function groupSidebarThreads(threads: readonly SidebarThread[]): GroupedSidebarThreads {
  const groupedThreads = new Map<string, SidebarThread[]>()
  const groupedWorktreeThreads = new Map<string, Map<string, SidebarThread[]>>()
  const unassignedThreads: SidebarThread[] = []

  for (const thread of threads) {
    const branchName = thread.branchName?.trim()
    if (!branchName) {
      unassignedThreads.push(thread)
      continue
    }

    if (thread.sidebarWorktreePath) {
      const worktreeThreadsByPath = groupedWorktreeThreads.get(branchName) ?? new Map()
      const worktreeThreads = worktreeThreadsByPath.get(thread.sidebarWorktreePath) ?? []
      worktreeThreads.push(thread)
      worktreeThreadsByPath.set(thread.sidebarWorktreePath, worktreeThreads)
      groupedWorktreeThreads.set(branchName, worktreeThreadsByPath)
      continue
    }

    const branchThreads = groupedThreads.get(branchName) ?? []
    branchThreads.push(thread)
    groupedThreads.set(branchName, branchThreads)
  }

  return { groupedThreads, groupedWorktreeThreads, unassignedThreads }
}

function collectBranchNames(input: {
  currentBranch: string | null
  groupedThreads: ReadonlyMap<string, SidebarThread[]>
  repositoryBranches: readonly string[]
  worktreesByBranch: ReadonlyMap<string, readonly WorktreeBranch[]>
}) {
  const branchNames = new Set<string>()
  for (const branch of input.repositoryBranches) {
    const normalizedBranch = branch.trim()
    if (normalizedBranch) branchNames.add(normalizedBranch)
  }
  for (const branchName of input.groupedThreads.keys()) branchNames.add(branchName)
  if (input.currentBranch) branchNames.add(input.currentBranch)
  for (const branchName of input.worktreesByBranch.keys()) branchNames.add(branchName)
  return branchNames
}

function getCompletedWorktreesForBulkActions(groups: readonly BranchThreadGroup[]) {
  return groups.flatMap((group) => {
    const nestedCompleted = group.worktrees.filter((worktree) => worktree.complete)
    if (!(group.worktree && group.worktreeComplete && group.worktreePath)) return nestedCompleted
    return [
      ...nestedCompleted,
      {
        label: group.label,
        path: group.worktreePath,
        branchName: group.worktreeBranchName ?? group.label,
        complete: true,
      },
    ]
  })
}

function addBulkCompletedWorktreesToCurrentBranch(groups: BranchThreadGroup[]) {
  const completedWorktrees = getCompletedWorktreesForBulkActions(groups)
  if (completedWorktrees.length === 0) return groups

  const currentGroupIndex = groups.findIndex((group) => group.current && !group.worktree)
  if (currentGroupIndex === -1) return groups

  return groups.map((group, index) =>
    index === currentGroupIndex ? { ...group, completedWorktrees } : group,
  )
}

export function bucketThreads(project: Project, selectedThreadId: string | null): ThreadBuckets {
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

export function buildBranchGroups(
  threads: SidebarThread[],
  currentBranch: string | null,
  repositoryBranches: readonly string[],
  worktreeBranches: readonly WorktreeBranch[] = [],
): BranchThreadGroup[] {
  const { groupedThreads, groupedWorktreeThreads, unassignedThreads } = groupSidebarThreads(threads)
  const worktreesByBranch = buildWorktreesByBranch(worktreeBranches)
  const branchNames = collectBranchNames({
    currentBranch,
    groupedThreads,
    repositoryBranches,
    worktreesByBranch,
  })

  const groups: BranchThreadGroup[] = []
  if (currentBranch && branchNames.has(currentBranch)) {
    groups.push(
      createBranchThreadGroup({
        branchName: currentBranch,
        current: true,
        groupedThreads,
        groupedWorktreeThreads,
        worktreesByBranch,
      }),
    )
    branchNames.delete(currentBranch)
  }

  const otherBranchGroups = [...branchNames]
    .map((branchName) =>
      createBranchThreadGroup({
        branchName,
        current: false,
        groupedThreads,
        groupedWorktreeThreads,
        worktreesByBranch,
      }),
    )
    .sort((a, b) => {
      const aHasWorktrees = a.worktree || a.worktrees.length > 0
      const bHasWorktrees = b.worktree || b.worktrees.length > 0
      if (aHasWorktrees !== bHasWorktrees) return aHasWorktrees ? -1 : 1
      return a.label.localeCompare(b.label)
    })

  groups.push(...otherBranchGroups)

  if (unassignedThreads.length > 0) {
    groups.push({
      id: UNASSIGNED_BRANCH_GROUP_ID,
      label: 'Unassigned',
      threads: sortThreads(unassignedThreads),
      worktrees: [],
      current: false,
      unassigned: true,
      worktree: false,
    })
  }

  if (groups.length === 0) {
    groups.push({
      id: UNASSIGNED_BRANCH_GROUP_ID,
      label: 'Unassigned',
      threads: [],
      worktrees: [],
      current: false,
      unassigned: true,
      worktree: false,
    })
  }

  return addBulkCompletedWorktreesToCurrentBranch(groups)
}

export function filterBranchGroups(groups: BranchThreadGroup[], searchQuery: string) {
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
      worktrees: group.worktrees.map((worktree) => ({
        ...worktree,
        threads: worktree.threads.filter((thread) =>
          [thread.title, thread.summary ?? '', thread.branchName ?? group.label]
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearchQuery),
        ),
      })),
    }))
    .filter(
      (group) =>
        group.label.toLowerCase().includes(normalizedSearchQuery) ||
        group.threads.length > 0 ||
        group.worktrees.some(
          (worktree) =>
            worktree.label.toLowerCase().includes(normalizedSearchQuery) ||
            worktree.threads.some((thread) =>
              [thread.title, thread.summary ?? '', thread.branchName ?? group.label]
                .join(' ')
                .toLowerCase()
                .includes(normalizedSearchQuery),
            ),
        ),
    )
}

export function getProjectGitStateForSidebar(
  projectId: string,
  projectGitState: ProjectGitState | null,
  gitStatesByProjectId: ReadonlyMap<string, ProjectGitState | null>,
) {
  if (projectGitState?.projectId === projectId) return projectGitState
  return gitStatesByProjectId.get(projectId) ?? null
}

export function getCurrentBranchForProject(
  project: Project,
  projectGitState: ProjectGitState | null,
  gitStatesByProjectId: ReadonlyMap<string, ProjectGitState | null>,
) {
  const gitState = getProjectGitStateForSidebar(project.id, projectGitState, gitStatesByProjectId)
  return gitState?.isGitRepo ? gitState.branch : null
}

export function getRepositoryBranchesForProject(
  project: Project,
  projectGitState: ProjectGitState | null,
  gitStatesByProjectId: ReadonlyMap<string, ProjectGitState | null>,
) {
  const gitState = getProjectGitStateForSidebar(project.id, projectGitState, gitStatesByProjectId)
  return gitState?.isGitRepo ? gitState.branches : []
}

export function getWorktreeBranchesForProject(
  project: Project,
  projects: readonly Project[],
  projectGitState: ProjectGitState | null,
  gitStatesByProjectId: ReadonlyMap<string, ProjectGitState | null>,
): WorktreeBranch[] {
  if (project.worktree && !project.worktree.isMain) return []

  const gitState = getProjectGitStateForSidebar(project.id, projectGitState, gitStatesByProjectId)
  if (!gitState?.isGitRepo) return []
  const rootProjectId = project.worktree?.rootProjectId ?? project.id
  const projectById = new Map(projects.map((candidate) => [candidate.id, candidate]))

  return gitState.worktrees
    .filter((worktree) => worktree.path !== project.id && worktree.path !== rootProjectId)
    .map((worktree) => ({
      label:
        worktree.branch ??
        worktree.path.split(pathSeparatorPattern).filter(Boolean).at(-1) ??
        worktree.path,
      path: worktree.path,
      branchName: worktree.branch ?? undefined,
      complete: projectById.get(worktree.path)?.worktree?.completed ?? false,
    }))
}

export function getWorktreeProjectsForRoot(project: Project, projects: readonly Project[]) {
  return projects.filter(
    (candidate) =>
      candidate.id !== project.id &&
      candidate.worktree?.rootProjectId === project.id &&
      candidate.worktree.isMain === false,
  )
}

export function getThreadsForProjectWorktreeRows(project: Project, projects: readonly Project[]) {
  return getWorktreeProjectsForRoot(project, projects).flatMap((worktreeProject) =>
    worktreeProject.threads.map((thread) => ({
      ...thread,
      sidebarWorktreePath: worktreeProject.id,
      branchName: thread.branchName ?? worktreeProject.worktree?.branchName ?? undefined,
    })),
  )
}

export function filterThreadsForCurrentBranch(
  threads: readonly Thread[],
  currentBranch: string | null,
) {
  if (!currentBranch) return []
  return sortThreads(threads.filter((thread) => thread.branchName === currentBranch))
}

export function filterThreadsBySearch(threads: readonly Thread[], searchQuery: string) {
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  if (!normalizedSearchQuery) return [...threads]
  return threads.filter((thread) =>
    [thread.title, thread.summary ?? '', thread.branchName ?? '']
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearchQuery),
  )
}
