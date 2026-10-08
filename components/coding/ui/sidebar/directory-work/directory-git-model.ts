import type { DirectoryGitState } from '../../../../../src/app/desktop/types'
import type { WorkingDirectory } from '../../../../../src/app/types'
import type { WorktreeBranch } from './branch-group-model'

const pathSeparatorPattern = /[\\/]/

export function getDirectoryGitStateForSidebar(
  directoryId: string,
  directoryGitState: DirectoryGitState | null,
  gitStatesByDirectoryId: ReadonlyMap<string, DirectoryGitState | null>,
) {
  if (directoryGitState?.directoryId === directoryId) return directoryGitState
  return gitStatesByDirectoryId.get(directoryId) ?? null
}

export function getCurrentBranchForDirectory(
  directory: WorkingDirectory,
  directoryGitState: DirectoryGitState | null,
  gitStatesByDirectoryId: ReadonlyMap<string, DirectoryGitState | null>,
) {
  const gitState = getDirectoryGitStateForSidebar(
    directory.id,
    directoryGitState,
    gitStatesByDirectoryId,
  )
  return gitState?.isGitRepo ? gitState.branch : null
}

export function getRepositoryBranchesForDirectory(
  directory: WorkingDirectory,
  directoryGitState: DirectoryGitState | null,
  gitStatesByDirectoryId: ReadonlyMap<string, DirectoryGitState | null>,
) {
  const gitState = getDirectoryGitStateForSidebar(
    directory.id,
    directoryGitState,
    gitStatesByDirectoryId,
  )
  return gitState?.isGitRepo ? gitState.branches : []
}

export function hasUncommittedDirectoryChanges(directoryGitState: DirectoryGitState | null) {
  return Boolean(
    directoryGitState &&
      (directoryGitState.stagedFileCount > 0 ||
        directoryGitState.unstagedFileCount > 0 ||
        directoryGitState.untrackedFileCount > 0),
  )
}

export function getWorktreeBranchesForDirectory(
  directory: WorkingDirectory,
  directories: readonly WorkingDirectory[],
  directoryGitState: DirectoryGitState | null,
  gitStatesByDirectoryId: ReadonlyMap<string, DirectoryGitState | null>,
): WorktreeBranch[] {
  if (directory.worktree && !directory.worktree.isMain) return []

  const gitState = getDirectoryGitStateForSidebar(
    directory.id,
    directoryGitState,
    gitStatesByDirectoryId,
  )
  if (!gitState?.isGitRepo) return []
  const rootDirectoryId = directory.worktree?.rootDirectoryId ?? directory.id
  const directoryById = new Map(directories.map((candidate) => [candidate.id, candidate]))

  return gitState.worktrees.flatMap((worktree) =>
    worktree.path !== directory.id && worktree.path !== rootDirectoryId
      ? [
          {
            label:
              worktree.branch ??
              worktree.path.split(pathSeparatorPattern).filter(Boolean).at(-1) ??
              worktree.path,
            path: worktree.path,
            branchName: worktree.branch ?? null,
            parentBranchName: directoryById.get(worktree.path)?.worktree?.parentBranchName ?? null,
            complete: directoryById.get(worktree.path)?.worktree?.completed ?? false,
          },
        ]
      : [],
  )
}
