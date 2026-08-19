import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { PiResourceInstallScope } from './types'

export function usePiResourceInstallScope({
  projectPath,
  onProjectTargetSelected,
  onSetProjectScopeActive,
}: {
  projectPath: string | null
  onProjectTargetSelected?: (() => void) | undefined
  onSetProjectScopeActive: (active: boolean) => void
}) {
  const [installScope, setInstallScope] = useState<PiResourceInstallScope>('global')
  const normalizedProjectPath = projectPath?.trim() ? projectPath : null
  const previousProjectPathRef = useRef(normalizedProjectPath)
  const notifyProjectScopeActive = useEffectEvent(onSetProjectScopeActive)

  // Target selection is intentionally reinforced at three points: the sidebar click keeps
  // target mode highlighted, its event selects Project scope, and this path-change callback
  // keeps target mode active after the asynchronous project selection reconciles.
  useEffect(() => {
    if (previousProjectPathRef.current === normalizedProjectPath) return
    previousProjectPathRef.current = normalizedProjectPath
    onProjectTargetSelected?.()
  }, [normalizedProjectPath, onProjectTargetSelected])

  useEffect(() => {
    const selectProjectScope = () => setInstallScope('project')
    window.addEventListener('howcode:project-target-selected', selectProjectScope)
    return () => window.removeEventListener('howcode:project-target-selected', selectProjectScope)
  }, [])

  useEffect(() => {
    notifyProjectScopeActive(installScope === 'project' || installScope === 'chat')
    return () => notifyProjectScopeActive(false)
  }, [installScope])

  return {
    installScope,
    normalizedProjectPath,
    projectScopeAvailable: normalizedProjectPath !== null,
    setInstallScope,
  }
}
