import { useEffect, useEffectEvent } from 'react'
import type { Project } from '../../../types'
import { getWorktreeProjectsForRoot } from './project-thread-model'

export function useProjectThreadLoading({
  allWorkspaces,
  visibleProjects,
  onLoadProjectThreads,
}: {
  allWorkspaces: readonly Project[]
  visibleProjects: readonly Project[]
  onLoadProjectThreads: (projectId: string, options?: { chat?: boolean }) => Promise<unknown>
}) {
  const loadProjectThreads = useEffectEvent(onLoadProjectThreads)

  useEffect(() => {
    const projectsToLoad = new Map(visibleProjects.map((project) => [project.id, project]))
    for (const project of visibleProjects) {
      for (const worktreeProject of getWorktreeProjectsForRoot(project, allWorkspaces)) {
        projectsToLoad.set(worktreeProject.id, worktreeProject)
      }
    }
    for (const project of projectsToLoad.values()) {
      if (project.threadsLoaded) continue
      void loadProjectThreads(project.id, { chat: false })
    }
  }, [allWorkspaces, visibleProjects])
}
