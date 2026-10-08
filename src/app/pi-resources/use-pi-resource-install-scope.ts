import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { PiResourceInstallScope } from './types'

export function usePiResourceInstallScope({
  directoryPath,
  onDirectoryTargetSelected,
  onSetDirectoryScopeActive,
}: {
  directoryPath: string | null
  onDirectoryTargetSelected?: (() => void) | undefined
  onSetDirectoryScopeActive: (active: boolean) => void
}) {
  const [installScope, setInstallScope] = useState<PiResourceInstallScope>('global')
  const normalizedDirectoryPath = directoryPath?.trim() ? directoryPath : null
  const previousDirectoryPathRef = useRef(normalizedDirectoryPath)
  const notifyDirectoryScopeActive = useEffectEvent(onSetDirectoryScopeActive)

  // Target selection is intentionally reinforced at three points: the sidebar click keeps
  // target mode highlighted, its event selects WorkingDirectory scope, and this path-change callback
  // keeps target mode active after the asynchronous directory selection reconciles.
  useEffect(() => {
    if (previousDirectoryPathRef.current === normalizedDirectoryPath) return
    previousDirectoryPathRef.current = normalizedDirectoryPath
    onDirectoryTargetSelected?.()
  }, [normalizedDirectoryPath, onDirectoryTargetSelected])

  useEffect(() => {
    const selectDirectoryScope = () => setInstallScope('directory')
    window.addEventListener('howcode:project-target-selected', selectDirectoryScope)
    return () => window.removeEventListener('howcode:project-target-selected', selectDirectoryScope)
  }, [])

  useEffect(() => {
    notifyDirectoryScopeActive(installScope === 'directory' || installScope === 'chat')
    return () => notifyDirectoryScopeActive(false)
  }, [installScope])

  return {
    installScope,
    normalizedDirectoryPath,
    directoryScopeAvailable: normalizedDirectoryPath !== null,
    setInstallScope,
  }
}
