import { isToolkitComponentEnabled } from '@howcode/shared/toolkit-components'
import { type Dispatch, type SetStateAction, useEffect } from 'react'
import type { AppSettings, DirectoryGitState } from '../desktop/types'

export function useGitStateSync({
  detailOpen,
  composerDirectoryId,
  shellAppSettings,
  loadDirectoryGitState,
  setDirectoryGitState,
  setDirectoryGitLoading,
}: {
  detailOpen: boolean
  composerDirectoryId: string
  shellAppSettings: AppSettings | null | undefined
  loadDirectoryGitState: (directoryId: string) => Promise<DirectoryGitState | null>
  setDirectoryGitState: Dispatch<SetStateAction<DirectoryGitState | null>>
  setDirectoryGitLoading: Dispatch<SetStateAction<boolean>>
}) {
  const codingEnabled =
    shellAppSettings != null && isToolkitComponentEnabled(shellAppSettings, 'coding')
  useEffect(() => {
    if (!(codingEnabled && composerDirectoryId)) {
      setDirectoryGitState(null)
      setDirectoryGitLoading(false)
      return
    }

    setDirectoryGitState(null)
    setDirectoryGitLoading(true)

    let cancelled = false

    const syncDirectoryGitState = async () => {
      try {
        const nextDirectoryGitState = await loadDirectoryGitState(composerDirectoryId)
        if (!cancelled) {
          setDirectoryGitState(nextDirectoryGitState)
        }
      } finally {
        if (!cancelled) {
          setDirectoryGitLoading(false)
        }
      }
    }

    void syncDirectoryGitState()

    return () => {
      cancelled = true
    }
  }, [
    codingEnabled,
    composerDirectoryId,
    loadDirectoryGitState,
    setDirectoryGitLoading,
    setDirectoryGitState,
  ])

  useEffect(() => {
    if (!(codingEnabled && detailOpen && composerDirectoryId)) {
      return
    }

    let cancelled = false
    setDirectoryGitLoading(true)

    void loadDirectoryGitState(composerDirectoryId)
      .then((nextDirectoryGitState) => {
        if (!cancelled) {
          setDirectoryGitState(nextDirectoryGitState)
        }
      })
      .catch((error) => {
        console.warn('Failed to refresh workspace git state for the diff panel.', error)
      })
      .finally(() => {
        if (!cancelled) {
          setDirectoryGitLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    codingEnabled,
    composerDirectoryId,
    loadDirectoryGitState,
    setDirectoryGitLoading,
    setDirectoryGitState,
    detailOpen,
  ])
}
