import { useSidebarRepositorySnapshot } from '@howaboua/howcode-sdk/sidebar-renderer'
import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { type SetStateAction, useCallback, useReducer, useState } from 'react'
import type { DirectoryGitState } from '../desktop/types'
import { useSkillsDirectoryScopeState } from '../skills-integration'
import { createInitialWorkspaceState, workspaceReducer } from '../state/workspace'
import { useAppShellChatState } from './useAppShellChatState'
import { useAppShellComposerState } from './useAppShellComposerState'

export function useAppShellStateBundle() {
  const [appLaunchedAtMs] = useState(() => Date.now())
  const [state, dispatch] = useReducer(workspaceReducer, [], createInitialWorkspaceState)
  const [settingsOpenTarget, setSettingsOpenTarget] = useState<SettingsOpenTarget | null>(null)
  const composer = useAppShellComposerState()
  const repository = useSidebarRepositorySnapshot()
  const setGitState = useCallback(
    (next: SetStateAction<DirectoryGitState | null>) => {
      repository.updateRepository?.(next)
    },
    [repository.updateRepository],
  )
  const setGitLoading = useCallback(
    (next: SetStateAction<boolean>) => {
      repository.setLoading?.(next)
    },
    [repository.setLoading],
  )
  const directories = {
    gitState: repository.state,
    gitLoading: repository.loading,
    setGitState,
    setGitLoading,
  }
  const resourceScope = useSkillsDirectoryScopeState()
  const chat = useAppShellChatState()

  return {
    appLaunchedAtMs,
    composer,
    directories,
    resourceScope,
    settings: { openTarget: settingsOpenTarget, setOpenTarget: setSettingsOpenTarget },
    chat,
    workspace: { dispatch, state },
  }
}
