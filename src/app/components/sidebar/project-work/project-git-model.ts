import type { ProjectGitState } from '../../../desktop/types'
import type { Project } from '../../../types'
import type { WorktreeBranch } from './branch-group-model'

const pathSeparatorPattern = /[\\/]/

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

export function hasUncommittedProjectChanges(projectGitState: ProjectGitState | null) {
  return Boolean(
    projectGitState &&
      (projectGitState.stagedFileCount > 0 ||
        projectGitState.unstagedFileCount > 0 ||
        projectGitState.untrackedFileCount > 0),
  )
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

  return gitState.worktrees.flatMap((worktree) =>
    worktree.path !== project.id && worktree.path !== rootProjectId
      ? [
          {
            label:
              worktree.branch ??
              worktree.path.split(pathSeparatorPattern).filter(Boolean).at(-1) ??
              worktree.path,
            path: worktree.path,
            branchName: worktree.branch ?? null,
            parentBranchName: projectById.get(worktree.path)?.worktree?.parentBranchName ?? null,
            complete: projectById.get(worktree.path)?.worktree?.completed ?? false,
          },
        ]
      : [],
  )
}
