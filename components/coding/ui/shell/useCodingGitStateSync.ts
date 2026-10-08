import { isToolkitComponentEnabled } from '@howcode/shared/toolkit-components'
import { type Dispatch, type SetStateAction, useEffect } from 'react'
import type { AppSettings, ProjectGitState } from '../../../../src/app/desktop/types'
import type { View } from '../../../../src/app/types'

export function useCodingGitStateSync({
  activeView,
  composerProjectId,
  shellAppSettings,
  loadProjectGitState,
  setProjectGitState,
  setProjectGitLoading,
}: {
  activeView: View
  composerProjectId: string
  shellAppSettings: AppSettings | null | undefined
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>
  setProjectGitState: Dispatch<SetStateAction<ProjectGitState | null>>
  setProjectGitLoading: Dispatch<SetStateAction<boolean>>
}) {
  const codingEnabled =
    shellAppSettings != null && isToolkitComponentEnabled(shellAppSettings, 'coding')
  useEffect(() => {
    if (!(codingEnabled && composerProjectId)) {
      setProjectGitState(null)
      setProjectGitLoading(false)
      return
    }

    setProjectGitState(null)
    setProjectGitLoading(true)

    let cancelled = false

    const syncProjectGitState = async () => {
      try {
        const nextProjectGitState = await loadProjectGitState(composerProjectId)
        if (!cancelled) {
          setProjectGitState(nextProjectGitState)
        }
      } finally {
        if (!cancelled) {
          setProjectGitLoading(false)
        }
      }
    }

    void syncProjectGitState()

    return () => {
      cancelled = true
    }
  }, [
    codingEnabled,
    composerProjectId,
    loadProjectGitState,
    setProjectGitLoading,
    setProjectGitState,
  ])

  useEffect(() => {
    if (!codingEnabled || activeView !== 'gitops' || !composerProjectId) {
      return
    }

    let cancelled = false
    setProjectGitLoading(true)

    void loadProjectGitState(composerProjectId)
      .then((nextProjectGitState) => {
        if (!cancelled) {
          setProjectGitState(nextProjectGitState)
        }
      })
      .catch((error) => {
        console.warn('Failed to refresh workspace git state for the diff panel.', error)
      })
      .finally(() => {
        if (!cancelled) {
          setProjectGitLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    codingEnabled,
    composerProjectId,
    loadProjectGitState,
    setProjectGitLoading,
    setProjectGitState,
    activeView,
  ])
}
