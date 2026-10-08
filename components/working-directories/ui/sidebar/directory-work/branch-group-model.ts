import type { Chat } from '../../../../../src/app/types'
import { type SidebarChat, sortChats } from './directory-chat-model'

export const UNASSIGNED_BRANCH_GROUP_ID = '__unassigned__'

type BranchWorkspaceBase = {
  id: string
  label: string
  chats: Chat[]
  worktrees: WorktreeBranchGroup[]
}

export type BranchWorkspace =
  | (BranchWorkspaceBase & { kind: 'branch'; current: boolean })
  | (BranchWorkspaceBase & { kind: 'unassigned' })
  | (BranchWorkspaceBase & {
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
  chats: Chat[]
}

type GroupedSidebarChats = {
  groupedChats: Map<string, SidebarChat[]>
  groupedWorktreeChats: Map<string, SidebarChat[]>
  unassignedChats: SidebarChat[]
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

function createBranchWorkspace(input: {
  branchName: string
  current: boolean
  groupedChats: ReadonlyMap<string, SidebarChat[]>
  groupedWorktreeChats: ReadonlyMap<string, SidebarChat[]>
  worktreesByBranch: ReadonlyMap<string, readonly WorktreeBranch[]>
}): BranchWorkspace {
  const branchWorktrees = input.worktreesByBranch.get(input.branchName) ?? []
  const worktrees = branchWorktrees
    .map((worktree) => ({
      ...worktree,
      id: worktree.path,
      complete: Boolean(worktree.complete),
      chats: sortChats([...(input.groupedWorktreeChats.get(worktree.path) ?? [])]),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const branchChats = sortChats(input.groupedChats.get(input.branchName) ?? [])
  return {
    id: input.branchName,
    label: input.branchName,
    chats: branchChats,
    worktrees,
    kind: 'branch',
    current: input.current,
  }
}

function groupSidebarChats(chats: readonly SidebarChat[]): GroupedSidebarChats {
  const groupedChats = new Map<string, SidebarChat[]>()
  const groupedWorktreeChats = new Map<string, SidebarChat[]>()
  const unassignedChats: SidebarChat[] = []

  for (const chat of chats) {
    const branchName = chat.branchName?.trim()
    if (!branchName) {
      unassignedChats.push(chat)
      continue
    }

    if (chat.sidebarWorktreePath) {
      const worktreeChats = groupedWorktreeChats.get(chat.sidebarWorktreePath) ?? []
      worktreeChats.push(chat)
      groupedWorktreeChats.set(chat.sidebarWorktreePath, worktreeChats)
      continue
    }

    const branchChats = groupedChats.get(branchName) ?? []
    branchChats.push(chat)
    groupedChats.set(branchName, branchChats)
  }

  return { groupedChats, groupedWorktreeChats, unassignedChats }
}

function collectBranchNames(input: {
  currentBranch: string | null
  groupedChats: ReadonlyMap<string, SidebarChat[]>
  repositoryBranches: readonly string[]
  worktreesByBranch: ReadonlyMap<string, readonly WorktreeBranch[]>
}) {
  const branchNames = new Set<string>()
  for (const branch of input.repositoryBranches) {
    const normalizedBranch = branch.trim()
    if (normalizedBranch) branchNames.add(normalizedBranch)
  }

  for (const branchName of input.groupedChats.keys()) branchNames.add(branchName)
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
  chats: SidebarChat[],
  currentBranch: string | null,
  repositoryBranches: readonly string[],
  worktreeBranches: readonly WorktreeBranch[] = [],
): BranchWorkspace[] {
  const { groupedChats, groupedWorktreeChats, unassignedChats } = groupSidebarChats(chats)
  const worktreesByBranch = buildWorktreesByBranch({ worktreeBranches })
  const branchNames = collectBranchNames({
    currentBranch,
    groupedChats,
    repositoryBranches,
    worktreesByBranch,
  })
  removeNestedWorktreeBranchNames({ branchNames, currentBranch, worktreeBranches })

  const groups: BranchWorkspace[] = []
  if (currentBranch && branchNames.has(currentBranch)) {
    groups.push(
      createBranchWorkspace({
        branchName: currentBranch,
        current: true,
        groupedChats,
        groupedWorktreeChats,
        worktreesByBranch,
      }),
    )
    branchNames.delete(currentBranch)
  }

  const otherBranchGroups = [...branchNames]
    .map((branchName) =>
      createBranchWorkspace({
        branchName,
        current: false,
        groupedChats,
        groupedWorktreeChats,
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

  if (unassignedChats.length > 0) {
    groups.push({
      id: UNASSIGNED_BRANCH_GROUP_ID,
      label: 'Unassigned',
      chats: sortChats(unassignedChats),
      worktrees: [],
      kind: 'unassigned',
    })
  }

  if (groups.length === 0) {
    groups.push({
      id: UNASSIGNED_BRANCH_GROUP_ID,
      label: 'Unassigned',
      chats: [],
      worktrees: [],
      kind: 'unassigned',
    })
  }

  return groups
}

function chatMatchesSearch(chat: Chat, groupLabel: string, searchQuery: string) {
  return [chat.title, chat.summary ?? '', chat.branchName ?? groupLabel]
    .join(' ')
    .toLowerCase()
    .includes(searchQuery)
}

export function filterBranchGroups(groups: BranchWorkspace[], searchQuery: string) {
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  if (!normalizedSearchQuery) return groups

  return groups.flatMap((group) => {
    const filteredGroup = {
      ...group,
      chats: group.chats.filter((chat) =>
        chatMatchesSearch(chat, group.label, normalizedSearchQuery),
      ),
      worktrees: group.worktrees.map((worktree) => ({
        ...worktree,
        chats: worktree.chats.filter((chat) =>
          chatMatchesSearch(chat, group.label, normalizedSearchQuery),
        ),
      })),
    }
    return filteredGroup.label.toLowerCase().includes(normalizedSearchQuery) ||
      filteredGroup.chats.length > 0 ||
      filteredGroup.worktrees.some(
        (worktree) =>
          worktree.label.toLowerCase().includes(normalizedSearchQuery) ||
          worktree.chats.some((chat) =>
            chatMatchesSearch(chat, group.label, normalizedSearchQuery),
          ),
      )
      ? [filteredGroup]
      : []
  })
}

export function directoryBlockMatchesSearch(input: {
  branchGroups: BranchWorkspace[]
  normalizedSearchQuery: string
  directoryName: string
}) {
  if (input.normalizedSearchQuery.length === 0) return true
  return (
    input.directoryName.toLowerCase().includes(input.normalizedSearchQuery) ||
    input.branchGroups.length > 0
  )
}
