import { useState } from 'react'
import type { DirectoryGitState } from '../../../../src/app/desktop/types'

export function useAppShellDirectoryState() {
  const [gitState, setGitState] = useState<DirectoryGitState | null>(null)
  const [gitLoading, setGitLoading] = useState(false)

  return { gitLoading, gitState, setGitLoading, setGitState }
}
