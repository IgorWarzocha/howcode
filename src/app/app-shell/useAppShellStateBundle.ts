import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { useReducer, useState } from 'react'
import { createInitialWorkspaceState, workspaceReducer } from '../state/workspace'
import { useAppShellComposerState } from './useAppShellComposerState'
import { useAppShellProjectState } from './useAppShellProjectState'
import { useAppShellResourceScopeState } from './useAppShellResourceScopeState'
import { useAppShellThreadState } from './useAppShellThreadState'

export function useAppShellStateBundle() {
  const [appLaunchedAtMs] = useState(() => Date.now())
  const [state, dispatch] = useReducer(workspaceReducer, [], createInitialWorkspaceState)
  const [settingsOpenTarget, setSettingsOpenTarget] = useState<SettingsOpenTarget | null>(null)
  const composer = useAppShellComposerState()
  const projects = useAppShellProjectState()
  const resourceScope = useAppShellResourceScopeState()
  const thread = useAppShellThreadState()

  return {
    appLaunchedAtMs,
    composer,
    projects,
    resourceScope,
    settings: { openTarget: settingsOpenTarget, setOpenTarget: setSettingsOpenTarget },
    thread,
    workspace: { dispatch, state },
  }
}
