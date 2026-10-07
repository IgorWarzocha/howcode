import { useEffect, useRef } from 'react'
import type { DesktopAction } from '../../../../src/app/desktop/actions'
import type {
  AnyDesktopActionPayload,
  DesktopActionResult,
} from '../../../../src/app/desktop/types'
import type { Project } from '../../../../src/app/types'

export function useProjectRepoOriginRefresh({
  enabled = true,
  projects,
  selectedProjectId,
  runDesktopAction,
}: {
  enabled?: boolean
  projects: Project[]
  selectedProjectId: string
  runDesktopAction: (
    action: DesktopAction,
    payload?: AnyDesktopActionPayload | undefined,
  ) => Promise<DesktopActionResult | null>
}) {
  const inspectedProjectIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!enabled) return
    const selectedProject = projects.find((project) => project.id === selectedProjectId)
    if (!selectedProject || selectedProject.repoOriginChecked) {
      return
    }

    if (inspectedProjectIdsRef.current.has(selectedProject.id)) {
      return
    }

    inspectedProjectIdsRef.current.add(selectedProject.id)
    void runDesktopAction('project.refresh-repo-origin', { projectId: selectedProject.id })
  }, [enabled, projects, runDesktopAction, selectedProjectId])
}
