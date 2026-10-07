import { useState } from 'react'
import type { ProjectGitState } from '../../../../src/app/desktop/types'

export function useAppShellProjectState() {
  const [gitState, setGitState] = useState<ProjectGitState | null>(null)
  const [gitLoading, setGitLoading] = useState(false)

  return { gitLoading, gitState, setGitLoading, setGitState }
}
