import { useAppShellDirectoryState } from '@howcode/components/coding/ui'
import { useSkillsDirectoryScopeState } from '@howcode/components/skills/ui'
import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { useReducer, useState } from 'react'
import { createInitialWorkspaceState, workspaceReducer } from '../state/workspace'
import { useAppShellChatState } from './useAppShellChatState'
import { useAppShellComposerState } from './useAppShellComposerState'

export function useAppShellStateBundle() {
  const [appLaunchedAtMs] = useState(() => Date.now())
  const [state, dispatch] = useReducer(workspaceReducer, [], createInitialWorkspaceState)
  const [settingsOpenTarget, setSettingsOpenTarget] = useState<SettingsOpenTarget | null>(null)
  const composer = useAppShellComposerState()
  const directories = useAppShellDirectoryState()
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
