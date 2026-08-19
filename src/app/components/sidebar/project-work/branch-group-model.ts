import type { Thread } from '../../../types'
import { type SidebarThread, sortThreads } from './project-thread-model'

export const UNASSIGNED_BRANCH_GROUP_ID = '__unassigned__'

type BranchThreadGroupBase = {
  id: string
  label: string
  threads: Thread[]
  worktrees: WorktreeBranchGroup[]
}

export type BranchThreadGroup =
  | (BranchThreadGroupBase & { kind: 'branch'; current: boolean })
  | (BranchThreadGroupBase & { kind: 'unassigned' })
  | (BranchThreadGroupBase & {
      kind: 'worktree'
      worktreeComplete: boolean
      worktreePath: string
      worktreeBranchName: string | null
    })

export type WorktreeBranch = {
  label: string
  path: string
  branchName?: string | null | undefined
  parentBranchName?: string | null | undefined
  complete?: boolean | undefined
}

export type WorktreeBranchGroup = WorktreeBranch & {
  id: string
  threads: Thread[]
}

type GroupedSidebarThreads = {
  groupedThreads: Map<string, SidebarThread[]>
  groupedWorktreeThreads: Map<string, SidebarThread[]>
  unassignedThreads: SidebarThread[]
}

function buildWorktreesByBranch(input: { worktreeBranches: readonly WorktreeBranch[] }) {
  const worktreesByBranch = new Map<string, WorktreeBranch[]>()
  for (const worktreeBranch of input.worktreeBranches) {
    const ownBranchName = (worktreeBranch.branchName ?? worktreeBranch.label).trim()
    const explicitParentBranchName = worktreeBranch.parentBranchName?.trim()
    const branchName = explicitParentBranchName || ownBranchName
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
  groupedWorktreeThreads: ReadonlyMap<string, SidebarThread[]>
  worktreesByBranch: ReadonlyMap<string, readonly WorktreeBranch[]>
}): BranchThreadGroup {
  const branchWorktrees = input.worktreesByBranch.get(input.branchName) ?? []
  const worktrees = branchWorktrees
    .map((worktree) => ({
      ...worktree,
      id: worktree.path,
      complete: Boolean(worktree.complete),
      threads: sortThreads([...(input.groupedWorktreeThreads.get(worktree.path) ?? [])]),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const branchThreads = sortThreads(input.groupedThreads.get(input.branchName) ?? [])
  return {
    id: input.branchName,
    label: input.branchName,
    threads: branchThreads,
    worktrees,
    kind: 'branch',
    current: input.current,
  }
}

function groupSidebarThreads(threads: readonly SidebarThread[]): GroupedSidebarThreads {
  const groupedThreads = new Map<string, SidebarThread[]>()
  const groupedWorktreeThreads = new Map<string, SidebarThread[]>()
  const unassignedThreads: SidebarThread[] = []

  for (const thread of threads) {
    const branchName = thread.branchName?.trim()
    if (!branchName) {
      unassignedThreads.push(thread)
      continue
    }

    if (thread.sidebarWorktreePath) {
      const worktreeThreads = groupedWorktreeThreads.get(thread.sidebarWorktreePath) ?? []
      worktreeThreads.push(thread)
      groupedWorktreeThreads.set(thread.sidebarWorktreePath, worktreeThreads)
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

function removeNestedWorktreeBranchNames(input: {
  branchNames: Set<string>
  currentBranch: string | null
  worktreeBranches: readonly WorktreeBranch[]
}) {
  for (const worktree of input.worktreeBranches) {
    const branchName = (worktree.branchName ?? worktree.label).trim()
    if (!branchName || branchName === input.currentBranch) continue
    if (worktree.parentBranchName?.trim()) {
      input.branchNames.delete(branchName)
    }
  }
}

export function buildBranchGroups(
  threads: SidebarThread[],
  currentBranch: string | null,
  repositoryBranches: readonly string[],
  worktreeBranches: readonly WorktreeBranch[] = [],
): BranchThreadGroup[] {
  const { groupedThreads, groupedWorktreeThreads, unassignedThreads } = groupSidebarThreads(threads)
  const worktreesByBranch = buildWorktreesByBranch({ worktreeBranches })
  const branchNames = collectBranchNames({
    currentBranch,
    groupedThreads,
    repositoryBranches,
    worktreesByBranch,
  })
  removeNestedWorktreeBranchNames({ branchNames, currentBranch, worktreeBranches })

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
      const aHasWorktrees = a.worktrees.length > 0
      const bHasWorktrees = b.worktrees.length > 0
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
      kind: 'unassigned',
    })
  }

  if (groups.length === 0) {
    groups.push({
      id: UNASSIGNED_BRANCH_GROUP_ID,
      label: 'Unassigned',
      threads: [],
      worktrees: [],
      kind: 'unassigned',
    })
  }

  return groups
}

function threadMatchesSearch(thread: Thread, groupLabel: string, searchQuery: string) {
  return [thread.title, thread.summary ?? '', thread.branchName ?? groupLabel]
    .join(' ')
    .toLowerCase()
    .includes(searchQuery)
}

export function filterBranchGroups(groups: BranchThreadGroup[], searchQuery: string) {
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  if (!normalizedSearchQuery) return groups

  return groups.flatMap((group) => {
    const filteredGroup = {
      ...group,
      threads: group.threads.filter((thread) =>
        threadMatchesSearch(thread, group.label, normalizedSearchQuery),
      ),
      worktrees: group.worktrees.map((worktree) => ({
        ...worktree,
        threads: worktree.threads.filter((thread) =>
          threadMatchesSearch(thread, group.label, normalizedSearchQuery),
        ),
      })),
    }
    return filteredGroup.label.toLowerCase().includes(normalizedSearchQuery) ||
      filteredGroup.threads.length > 0 ||
      filteredGroup.worktrees.some(
        (worktree) =>
          worktree.label.toLowerCase().includes(normalizedSearchQuery) ||
          worktree.threads.some((thread) =>
            threadMatchesSearch(thread, group.label, normalizedSearchQuery),
          ),
      )
      ? [filteredGroup]
      : []
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
