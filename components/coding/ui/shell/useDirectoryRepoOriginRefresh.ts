import { useEffect, useRef } from 'react'
import type { DesktopAction } from '../../../../src/app/desktop/actions'
import type {
  AnyDesktopActionPayload,
  DesktopActionResult,
} from '../../../../src/app/desktop/types'
import type { WorkingDirectory } from '../../../../src/app/types'

export function useDirectoryRepoOriginRefresh({
  enabled = true,
  directories,
  selectedDirectoryId,
  runDesktopAction,
}: {
  enabled?: boolean
  directories: WorkingDirectory[]
  selectedDirectoryId: string
  runDesktopAction: (
    action: DesktopAction,
    payload?: AnyDesktopActionPayload | undefined,
  ) => Promise<DesktopActionResult | null>
}) {
  const inspectedDirectoryIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!enabled) return
    const selectedDirectory = directories.find((directory) => directory.id === selectedDirectoryId)
    if (!selectedDirectory || selectedDirectory.repoOriginChecked) {
      return
    }

    if (inspectedDirectoryIdsRef.current.has(selectedDirectory.id)) {
      return
    }

    inspectedDirectoryIdsRef.current.add(selectedDirectory.id)
    void runDesktopAction('directory.refresh-repo-origin', { directoryId: selectedDirectory.id })
  }, [enabled, directories, runDesktopAction, selectedDirectoryId])
}
