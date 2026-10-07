import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useMemo,
  useState,
} from 'react'
import type { View } from '../../../../src/app/types'

type WorkspacePreferences = {
  gitOpsFileTreeVisibilityByThread: Record<string, boolean>
  setGitOpsFileTreeVisibilityByThread: Dispatch<SetStateAction<Record<string, boolean>>>
  includeUntrackedDiffFilesByThread: Record<string, boolean>
  setIncludeUntrackedDiffFilesByThread: Dispatch<SetStateAction<Record<string, boolean>>>
}

const WorkspacePreferencesContext = createContext<WorkspacePreferences | null>(null)

// Preferences outlive route presentations, including visits to core utility views.
export function CodingWorkspacePreferencesProvider({
  children,
  activeView,
}: {
  children: ReactNode
  activeView: View
}) {
  const retain =
    activeView !== 'chat' &&
    activeView !== 'claw' &&
    activeView !== 'work' &&
    activeView !== 'automations'
  const [gitOpsFileTreeVisibilityByThread, setGitOpsFileTreeVisibilityByThread] = useState<
    Record<string, boolean>
  >({})
  const [includeUntrackedDiffFilesByThread, setIncludeUntrackedDiffFilesByThread] = useState<
    Record<string, boolean>
  >({})
  const [previousRetain, setPreviousRetain] = useState(retain)
  if (previousRetain !== retain) {
    setPreviousRetain(retain)
    if (!retain) {
      setGitOpsFileTreeVisibilityByThread({})
      setIncludeUntrackedDiffFilesByThread({})
    }
  }
  const value = useMemo(
    () => ({
      gitOpsFileTreeVisibilityByThread,
      setGitOpsFileTreeVisibilityByThread,
      includeUntrackedDiffFilesByThread,
      setIncludeUntrackedDiffFilesByThread,
    }),
    [gitOpsFileTreeVisibilityByThread, includeUntrackedDiffFilesByThread],
  )
  return <WorkspacePreferencesContext value={value}>{children}</WorkspacePreferencesContext>
}

export function useCodingWorkspacePreferences() {
  const preferences = useContext(WorkspacePreferencesContext)
  if (!preferences)
    throw new Error('Coding workspace preferences require their composition provider.')
  return preferences
}
