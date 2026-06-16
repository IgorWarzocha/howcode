import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { useReducer, useState } from 'react'
import type {
  ArchivedThread,
  ComposerState,
  PiExtensionUiState,
  ProjectGitState,
  ThreadData,
} from '../desktop/types'
import { createInitialWorkspaceState, workspaceReducer } from '../state/workspace'

export function useAppShellStateBundle() {
  const [appLaunchedAtMs] = useState(() => Date.now())
  const [state, dispatch] = useReducer(workspaceReducer, [], createInitialWorkspaceState)
  const [archivedThreads, setArchivedThreads] = useState<ArchivedThread[]>([])
  const [composerState, setComposerState] = useState<ComposerState | null>(null)
  const [piExtensionUiStateBySession, setPiExtensionUiStateBySession] = useState<
    Record<string, PiExtensionUiState>
  >({})
  const [liveThreadData, setLiveThreadData] = useState<ThreadData | null>(null)
  const [projectGitState, setProjectGitState] = useState<ProjectGitState | null>(null)
  const [projectGitLoading, setProjectGitLoading] = useState(false)
  const [extensionsProjectScopeActive, setExtensionsProjectScopeActive] = useState(false)
  const [skillsProjectScopeActive, setSkillsProjectScopeActive] = useState(false)
  const [settingsOpenTarget, setSettingsOpenTarget] = useState<SettingsOpenTarget | null>(null)
  const [threadRefreshKey, setThreadRefreshKey] = useState(0)
  const [threadHistoryCompactions, setThreadHistoryCompactions] = useState(0)
  const [threadQueryDeferred, setThreadQueryDeferred] = useState(false)

  return {
    appLaunchedAtMs,
    archivedThreads,
    composerState,
    dispatch,
    extensionsProjectScopeActive,
    liveThreadData,
    piExtensionUiStateBySession,
    projectGitLoading,
    projectGitState,
    setArchivedThreads,
    setComposerState,
    setExtensionsProjectScopeActive,
    setLiveThreadData,
    setPiExtensionUiStateBySession,
    setProjectGitLoading,
    setProjectGitState,
    setSettingsOpenTarget,
    setSkillsProjectScopeActive,
    setThreadHistoryCompactions,
    setThreadQueryDeferred,
    setThreadRefreshKey,
    settingsOpenTarget,
    skillsProjectScopeActive,
    state,
    threadHistoryCompactions,
    threadQueryDeferred,
    threadRefreshKey,
  }
}
