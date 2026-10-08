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
  gitOpsFileTreeVisibilityByChat: Record<string, boolean>
  setGitOpsFileTreeVisibilityByChat: Dispatch<SetStateAction<Record<string, boolean>>>
  includeUntrackedDiffFilesByChat: Record<string, boolean>
  setIncludeUntrackedDiffFilesByChat: Dispatch<SetStateAction<Record<string, boolean>>>
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
  const [gitOpsFileTreeVisibilityByChat, setGitOpsFileTreeVisibilityByChat] = useState<
    Record<string, boolean>
  >({})
  const [includeUntrackedDiffFilesByChat, setIncludeUntrackedDiffFilesByChat] = useState<
    Record<string, boolean>
  >({})
  const [previousRetain, setPreviousRetain] = useState(retain)
  if (previousRetain !== retain) {
    setPreviousRetain(retain)
    if (!retain) {
      setGitOpsFileTreeVisibilityByChat({})
      setIncludeUntrackedDiffFilesByChat({})
    }
  }
  const value = useMemo(
    () => ({
      gitOpsFileTreeVisibilityByChat,
      setGitOpsFileTreeVisibilityByChat,
      includeUntrackedDiffFilesByChat,
      setIncludeUntrackedDiffFilesByChat,
    }),
    [gitOpsFileTreeVisibilityByChat, includeUntrackedDiffFilesByChat],
  )
  return <WorkspacePreferencesContext value={value}>{children}</WorkspacePreferencesContext>
}

export function useCodingWorkspacePreferences() {
  const preferences = useContext(WorkspacePreferencesContext)
  if (!preferences)
    throw new Error('Coding workspace preferences require their composition provider.')
  return preferences
}
