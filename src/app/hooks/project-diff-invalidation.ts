import { useEffect, useState } from 'react'

const projectDiffInvalidationTarget = new EventTarget()
const PROJECT_DIFF_INVALIDATED_EVENT = 'howcode:project-diff-invalidated'

type ProjectDiffInvalidatedEvent = CustomEvent<{ projectId: string }>

export function notifyProjectDiffInvalidated(projectId: string) {
  projectDiffInvalidationTarget.dispatchEvent(
    new CustomEvent(PROJECT_DIFF_INVALIDATED_EVENT, { detail: { projectId } }),
  )
}

export function useProjectDiffInvalidationVersion(projectId: string | null) {
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!projectId) return

    const handleProjectDiffInvalidated = (event: Event) => {
      const invalidatedProjectId = (event as ProjectDiffInvalidatedEvent).detail?.projectId
      if (invalidatedProjectId !== projectId) return
      setVersion((current) => current + 1)
    }

    projectDiffInvalidationTarget.addEventListener(
      PROJECT_DIFF_INVALIDATED_EVENT,
      handleProjectDiffInvalidated,
    )
    return () => {
      projectDiffInvalidationTarget.removeEventListener(
        PROJECT_DIFF_INVALIDATED_EVENT,
        handleProjectDiffInvalidated,
      )
    }
  }, [projectId])

  return version
}
