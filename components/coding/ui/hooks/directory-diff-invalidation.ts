import { useEffect, useState } from 'react'

const directoryDiffInvalidationTarget = new EventTarget()
const PROJECT_DIFF_INVALIDATED_EVENT = 'howcode:project-diff-invalidated'

type DirectoryDiffInvalidatedEvent = CustomEvent<{ directoryId: string }>

export function notifyDirectoryDiffInvalidated(directoryId: string) {
  directoryDiffInvalidationTarget.dispatchEvent(
    new CustomEvent(PROJECT_DIFF_INVALIDATED_EVENT, { detail: { directoryId } }),
  )
}

export function useDirectoryDiffInvalidationVersion(directoryId: string | null) {
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!directoryId) return

    const handleDirectoryDiffInvalidated = (event: Event) => {
      const invalidatedDirectoryId = (event as DirectoryDiffInvalidatedEvent).detail?.directoryId
      if (invalidatedDirectoryId !== directoryId) return
      setVersion((current) => current + 1)
    }

    directoryDiffInvalidationTarget.addEventListener(
      PROJECT_DIFF_INVALIDATED_EVENT,
      handleDirectoryDiffInvalidated,
    )
    return () => {
      directoryDiffInvalidationTarget.removeEventListener(
        PROJECT_DIFF_INVALIDATED_EVENT,
        handleDirectoryDiffInvalidated,
      )
    }
  }, [directoryId])

  return version
}
