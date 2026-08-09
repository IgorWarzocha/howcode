import type { ShellState } from '../desktop/types'
import { desktopQueryKeys } from '../query/desktop-query'
import type { Project } from '../types'

type QueryClientLike = {
  setQueryData: (queryKey: readonly unknown[], updater: (current: unknown) => unknown) => void
}

type ProjectPatch = Partial<Omit<Project, 'id'>> & { id: string }

const pathSeparatorPattern = /[\\/]/

function getProjectName(projectId: string) {
  return projectId.split(pathSeparatorPattern).filter(Boolean).at(-1) || projectId
}

function createProjectFallback(projectId: string, name = getProjectName(projectId)): Project {
  return {
    id: projectId,
    name,
    threads: [],
    latestModifiedMs: 0,
    pinned: false,
    collapsed: false,
    threadCount: 0,
    threadsLoaded: false,
  }
}

function createPatchedProjectFallback(project: ProjectPatch): Project {
  return sameProjectReferenceOrPatch(createProjectFallback(project.id, project.name), project)
}

function patchProjects(
  queryClient: QueryClientLike,
  patcher: (projects: Project[], state: ShellState) => Project[],
) {
  queryClient.setQueryData(desktopQueryKeys.shellState(), (current) => {
    const currentState = current as ShellState | null | undefined
    if (!currentState) return currentState ?? null
    const projects = patcher(currentState.projects, currentState)
    return projects === currentState.projects ? currentState : { ...currentState, projects }
  })
}

function sameProjectReferenceOrPatch(project: Project, patch: ProjectPatch) {
  const changed = Object.entries(patch).some(
    ([key, value]) => key !== 'id' && Reflect.get(project, key) !== value,
  )
  return changed ? { ...project, ...patch } : project
}

export function upsertShellProject(
  queryClient: QueryClientLike,
  project: ProjectPatch,
  options: { reveal?: boolean } = {},
) {
  patchProjects(queryClient, (projects) => {
    const index = projects.findIndex((candidate) => candidate.id === project.id)
    const patch = options.reveal ? { ...project, collapsed: false } : project
    if (index === -1) return [createPatchedProjectFallback(patch), ...projects]
    const existingProject = projects[index]
    if (!existingProject) return projects
    const nextProject = sameProjectReferenceOrPatch(existingProject, patch)
    if (nextProject === existingProject) return projects
    return projects.map((candidate, candidateIndex) =>
      candidateIndex === index ? nextProject : candidate,
    )
  })
}

export function updateShellProject(
  queryClient: QueryClientLike,
  projectId: string,
  updater: (project: Project) => Project,
) {
  patchProjects(queryClient, (projects) => {
    let changed = false
    const nextProjects = projects.map((project) => {
      if (project.id !== projectId) return project
      const nextProject = updater(project)
      changed = changed || nextProject !== project
      return nextProject
    })
    return changed ? nextProjects : projects
  })
}

export function removeShellProjectFamily(queryClient: QueryClientLike, projectId: string) {
  patchProjects(queryClient, (projects) => {
    const nextProjects = projects.filter(
      (project) => project.id !== projectId && project.worktree?.rootProjectId !== projectId,
    )
    return nextProjects.length === projects.length ? projects : nextProjects
  })
}

export function upsertShellWorktreeProject(
  queryClient: QueryClientLike,
  input: {
    rootProjectId: string
    worktreeProjectId: string
    branchName: string | null
    parentBranchName?: string | null | undefined
  },
) {
  upsertShellProject(queryClient, {
    id: input.rootProjectId,
    worktree: {
      rootProjectId: input.rootProjectId,
      branchName: null,
      isMain: true,
      source: 'howcode',
    },
  })
  upsertShellProject(queryClient, {
    id: input.worktreeProjectId,
    name: getProjectName(input.worktreeProjectId),
    threadsLoaded: true,
    threadsScope: 'code',
    worktree: {
      rootProjectId: input.rootProjectId,
      branchName: input.branchName,
      parentBranchName: input.parentBranchName ?? null,
      isMain: false,
      source: 'howcode',
      completed: false,
    },
  })
}

export function removeShellWorktreeProject(
  queryClient: QueryClientLike,
  worktreeProjectId: string,
) {
  patchProjects(queryClient, (projects) => {
    const nextProjects = projects.filter((project) => project.id !== worktreeProjectId)
    return nextProjects.length === projects.length ? projects : nextProjects
  })
}

export function setShellWorktreeCompleted(
  queryClient: QueryClientLike,
  worktreeProjectId: string,
  completed: boolean,
) {
  updateShellProject(queryClient, worktreeProjectId, (project) => {
    if (!project.worktree || project.worktree.completed === completed) return project
    return { ...project, worktree: { ...project.worktree, completed } }
  })
}

export function setShellWorktreeDirectory(
  queryClient: QueryClientLike,
  rootProjectId: string,
  worktreeDirectory: string,
) {
  updateShellProject(queryClient, rootProjectId, (project) =>
    project.worktreeDirectory === worktreeDirectory ? project : { ...project, worktreeDirectory },
  )
}

export function setShellSidebarVisibleProjectIds(
  queryClient: QueryClientLike,
  projectIds: string[],
) {
  queryClient.setQueryData(desktopQueryKeys.shellState(), (current) => {
    const currentState = current as ShellState | null | undefined
    if (!currentState) return currentState ?? null
    if (
      currentState.sidebarVisibleProjectIds?.length === projectIds.length &&
      currentState.sidebarVisibleProjectIds.every(
        (projectId, index) => projectId === projectIds[index],
      )
    ) {
      return currentState
    }
    return { ...currentState, sidebarVisibleProjectIds: projectIds }
  })
}
