import type { QueryClient } from '@tanstack/react-query'
import type { DesktopAction } from '../desktop/actions'
import type {
  ComposerThinkingLevel,
  ModelSelection,
  PiSettings,
  ProjectDiffDefaultBaseline,
  ShellState,
} from '../desktop/types'
import { desktopQueryKeys } from '../query/desktop-query'
import {
  type ActionPayload,
  getPayloadProjectId,
  getPayloadThreadId,
  sortPinnedProjects,
  sortPinnedThreads,
} from './controller-action-utils'

const optimisticSettingKeys = new Set([
  'chatModel',
  'chatThinkingLevel',
  'codeModel',
  'codeThinkingLevel',
  'gitCommitMessageModel',
  'gitCommitMessageThinkingLevel',
  'skillCreatorModel',
  'skillCreatorThinkingLevel',
  'composerStreamingBehavior',
  'dictationModelId',
  'dictationMaxDurationSeconds',
  'showDictationButton',
  'favoriteFolders',
  'projectImportState',
  'preferredProjectLocation',
  'initializeGitOnProjectCreate',
  'gitOpsDefaultMode',
  'gitDiffBaselineDefault',
  'gitDiffRenderModeDefault',
  'gitDiffFileTreeDefaultVisible',
  'projectDeletionMode',
  'useAgentsSkillsPaths',
  'howcodeNativeAskQuestions',
  'piTuiTakeover',
  'hoverToFocus',
  'hoverToBlur',
])

const isThinkingLevel = (value: unknown): value is ComposerThinkingLevel =>
  value === 'off' ||
  value === 'minimal' ||
  value === 'low' ||
  value === 'medium' ||
  value === 'high' ||
  value === 'xhigh'

function getOptimisticModelSelection(
  payload: ActionPayload,
  fallback: ModelSelection | null,
): ModelSelection | null {
  if (payload.reset === true) return null
  return typeof payload.provider === 'string' && typeof payload.modelId === 'string'
    ? { provider: payload.provider, id: payload.modelId }
    : fallback
}

function getOptimisticFavoriteFolders(payload: ActionPayload, fallback: string[]) {
  return Array.isArray(payload.folders)
    ? [
        ...new Set(
          payload.folders
            .filter((folder): folder is string => typeof folder === 'string')
            .map((folder) => folder.trim())
            .filter(Boolean),
        ),
      ]
    : fallback
}

function getOptimisticDiffBaselineDefault(
  payload: ActionPayload,
  fallback: ProjectDiffDefaultBaseline,
) {
  if (!(payload.value && typeof payload.value === 'object')) return fallback
  const baseline = payload.value as { kind?: unknown }
  return baseline.kind === 'head' ||
    baseline.kind === 'previous' ||
    baseline.kind === 'yesterday' ||
    baseline.kind === 'main-branch' ||
    baseline.kind === 'dev-branch'
    ? ({ kind: baseline.kind } as ProjectDiffDefaultBaseline)
    : fallback
}

function applyOptimisticModelSetting(
  nextSettings: ShellState['appSettings'],
  payload: ActionPayload,
) {
  if (payload.key === 'chatModel')
    nextSettings.chatModel = getOptimisticModelSelection(payload, nextSettings.chatModel)
  if (payload.key === 'codeModel')
    nextSettings.codeModel = getOptimisticModelSelection(payload, nextSettings.codeModel)
  if (payload.key === 'gitCommitMessageModel') {
    nextSettings.gitCommitMessageModel = getOptimisticModelSelection(
      payload,
      nextSettings.gitCommitMessageModel,
    )
  }
  if (payload.key === 'skillCreatorModel') {
    nextSettings.skillCreatorModel = getOptimisticModelSelection(
      payload,
      nextSettings.skillCreatorModel,
    )
  }
}

function getResettableThinkingLevel(
  payload: ActionPayload,
  fallback: ComposerThinkingLevel | null,
) {
  if (payload.reset === true) return null
  return isThinkingLevel(payload.value) ? payload.value : fallback
}

function applyOptimisticThinkingSetting(
  nextSettings: ShellState['appSettings'],
  payload: ActionPayload,
) {
  if (payload.key === 'chatThinkingLevel') {
    nextSettings.chatThinkingLevel = getResettableThinkingLevel(
      payload,
      nextSettings.chatThinkingLevel,
    )
  }
  if (payload.key === 'codeThinkingLevel') {
    nextSettings.codeThinkingLevel = getResettableThinkingLevel(
      payload,
      nextSettings.codeThinkingLevel,
    )
  }
  if (payload.key === 'gitCommitMessageThinkingLevel' && isThinkingLevel(payload.value)) {
    nextSettings.gitCommitMessageThinkingLevel = payload.value
  }
  if (payload.key === 'skillCreatorThinkingLevel' && isThinkingLevel(payload.value)) {
    nextSettings.skillCreatorThinkingLevel = payload.value
  }
}

function applyOptimisticBooleanSetting(
  nextSettings: ShellState['appSettings'],
  payload: ActionPayload,
) {
  if (typeof payload.value !== 'boolean') return
  if (payload.key === 'showDictationButton') nextSettings.showDictationButton = payload.value
  if (payload.key === 'initializeGitOnProjectCreate')
    nextSettings.initializeGitOnProjectCreate = payload.value
  if (payload.key === 'gitDiffFileTreeDefaultVisible')
    nextSettings.gitDiffFileTreeDefaultVisible = payload.value
  if (payload.key === 'useAgentsSkillsPaths') nextSettings.useAgentsSkillsPaths = payload.value
  if (payload.key === 'howcodeNativeAskQuestions')
    nextSettings.howcodeNativeAskQuestions = payload.value
  if (payload.key === 'piTuiTakeover') nextSettings.piTuiTakeover = payload.value
  if (payload.key === 'hoverToFocus') nextSettings.hoverToFocus = payload.value
  if (payload.key === 'hoverToBlur') nextSettings.hoverToBlur = payload.value
}

function applyOptimisticComposerSetting(
  nextSettings: ShellState['appSettings'],
  payload: ActionPayload,
) {
  if (
    payload.key === 'composerStreamingBehavior' &&
    (payload.value === 'steer' || payload.value === 'followUp' || payload.value === 'stop')
  )
    nextSettings.composerStreamingBehavior = payload.value
}

function applyOptimisticDictationSetting(
  nextSettings: ShellState['appSettings'],
  payload: ActionPayload,
) {
  if (payload.key === 'dictationMaxDurationSeconds' && typeof payload.value === 'number')
    nextSettings.dictationMaxDurationSeconds = payload.value
  if (
    payload.key === 'dictationModelId' &&
    (payload.value === null ||
      payload.value === 'tiny.en' ||
      payload.value === 'base.en' ||
      payload.value === 'small.en')
  )
    nextSettings.dictationModelId = payload.value
}

function applyOptimisticScalarSetting(
  nextSettings: ShellState['appSettings'],
  payload: ActionPayload,
) {
  applyOptimisticComposerSetting(nextSettings, payload)
  applyOptimisticDictationSetting(nextSettings, payload)
  if (payload.key === 'favoriteFolders')
    nextSettings.favoriteFolders = getOptimisticFavoriteFolders(
      payload,
      nextSettings.favoriteFolders,
    )
  if (
    payload.key === 'projectImportState' &&
    (payload.imported === null || typeof payload.imported === 'boolean')
  )
    nextSettings.projectImportState = payload.imported
  if (payload.key === 'preferredProjectLocation')
    nextSettings.preferredProjectLocation =
      typeof payload.value === 'string' ? payload.value.trim() || null : null
}

function applyOptimisticGitSetting(
  nextSettings: ShellState['appSettings'],
  payload: ActionPayload,
) {
  if (
    payload.key === 'gitOpsDefaultMode' &&
    (payload.value === 'commit' || payload.value === 'commit-push')
  )
    nextSettings.gitOpsDefaultMode = payload.value
  if (payload.key === 'gitDiffBaselineDefault')
    nextSettings.gitDiffBaselineDefault = getOptimisticDiffBaselineDefault(
      payload,
      nextSettings.gitDiffBaselineDefault,
    )
  if (
    payload.key === 'gitDiffRenderModeDefault' &&
    (payload.value === 'stacked' || payload.value === 'split')
  )
    nextSettings.gitDiffRenderModeDefault = payload.value
  if (
    payload.key === 'projectDeletionMode' &&
    (payload.value === 'pi-only' || payload.value === 'full-clean')
  )
    nextSettings.projectDeletionMode = payload.value
}

export function getOptimisticallyUpdatedShellState(
  currentState: ShellState | null,
  payload: ActionPayload,
) {
  if (!(currentState && optimisticSettingKeys.has(String(payload.key)))) return currentState

  const appSettings = { ...currentState.appSettings }
  applyOptimisticModelSetting(appSettings, payload)
  applyOptimisticThinkingSetting(appSettings, payload)
  applyOptimisticBooleanSetting(appSettings, payload)
  applyOptimisticScalarSetting(appSettings, payload)
  applyOptimisticGitSetting(appSettings, payload)

  return { ...currentState, appSettings } satisfies ShellState
}

export function applyOptimisticSettingsUpdate(queryClient: QueryClient, payload: ActionPayload) {
  queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) =>
    getOptimisticallyUpdatedShellState(currentState ?? null, payload),
  )
}

function isPiSettingsKey(value: unknown): value is keyof PiSettings {
  return (
    typeof value === 'string' &&
    [
      'theme',
      'autoCompact',
      'enableSkillCommands',
      'hideThinkingBlock',
      'quietStartup',
      'showImages',
      'autoResizeImages',
      'blockImages',
      'collapseChangelog',
      'enableInstallTelemetry',
      'showHardwareCursor',
      'clearOnShrink',
      'transport',
      'steeringMode',
      'followUpMode',
      'doubleEscapeAction',
      'treeFilterMode',
      'editorPaddingX',
      'autocompleteMaxVisible',
      'imageWidthCells',
    ].includes(value)
  )
}

function getNumericPiSettingsValue<Key extends keyof PiSettings>(key: Key, value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const [min, max] =
    key === 'editorPaddingX' ? [0, 3] : key === 'autocompleteMaxVisible' ? [3, 20] : [1, 200]
  return Math.max(min, Math.min(max, Math.floor(value))) as PiSettings[Key]
}

function isValidPiSettingsStringValue(key: keyof PiSettings, value: unknown) {
  if (key === 'theme') return typeof value === 'string' && value.trim().length > 0
  if (key === 'transport') return value === 'sse' || value === 'websocket' || value === 'auto'
  if (key === 'steeringMode' || key === 'followUpMode')
    return value === 'all' || value === 'one-at-a-time'
  if (key === 'doubleEscapeAction') return value === 'fork' || value === 'tree' || value === 'none'
  if (key === 'treeFilterMode')
    return ['default', 'no-tools', 'user-only', 'labeled-only', 'all'].includes(String(value))
  return true
}

function getOptimisticPiSettingsValue<Key extends keyof PiSettings>(
  key: Key,
  value: unknown,
  currentValue: PiSettings[Key],
): PiSettings[Key] | null {
  if (typeof value !== typeof currentValue) return null
  if (key === 'editorPaddingX' || key === 'autocompleteMaxVisible' || key === 'imageWidthCells') {
    return getNumericPiSettingsValue(key, value)
  }
  if (!isValidPiSettingsStringValue(key, value)) return null
  return key === 'theme' ? (String(value).trim() as PiSettings[Key]) : (value as PiSettings[Key])
}

export function getOptimisticallyUpdatedPiSettingsState(
  currentState: ShellState | null,
  payload: ActionPayload,
) {
  if (!(currentState && isPiSettingsKey(payload.piSettingsKey))) {
    return currentState
  }

  const currentValue = currentState.piSettings[payload.piSettingsKey]
  const nextValue = getOptimisticPiSettingsValue(payload.piSettingsKey, payload.value, currentValue)
  if (nextValue === null) {
    return currentState
  }

  return {
    ...currentState,
    piSettings: {
      ...currentState.piSettings,
      [payload.piSettingsKey]: nextValue,
    },
  } satisfies ShellState
}

export function applyOptimisticPiSettingsUpdate(queryClient: QueryClient, payload: ActionPayload) {
  queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) =>
    getOptimisticallyUpdatedPiSettingsState(currentState ?? null, payload),
  )
}

export function getOptimisticallyRenamedShellState(
  currentState: ShellState | null,
  payload: ActionPayload,
) {
  if (!currentState) {
    return null
  }

  const projectId = getPayloadProjectId(payload)
  const projectName = typeof payload.projectName === 'string' ? payload.projectName.trim() : ''

  if (!projectId || projectName.length === 0) {
    return currentState
  }

  return {
    ...currentState,
    projects: currentState.projects.map((project) =>
      project.id === projectId ? { ...project, name: projectName } : project,
    ),
  } satisfies ShellState
}

export function applyOptimisticProjectRename(queryClient: QueryClient, payload: ActionPayload) {
  queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) =>
    getOptimisticallyRenamedShellState(currentState ?? null, payload),
  )
}

export function getOptimisticallyPinnedShellState(
  currentState: ShellState | null,
  action: DesktopAction,
  payload: ActionPayload,
) {
  if (!currentState) {
    return null
  }

  if (action === 'thread.pin') {
    const projectId = getPayloadProjectId(payload)
    const threadId = getPayloadThreadId(payload)

    if (!(projectId && threadId)) {
      return currentState
    }

    return {
      ...currentState,
      projects: currentState.projects.map((project) => {
        if (project.id !== projectId) {
          return project
        }

        const nextThreads = sortPinnedThreads(
          project.threads.map((thread) =>
            thread.id === threadId ? { ...thread, pinned: !thread.pinned } : thread,
          ),
        )

        return {
          ...project,
          threads: nextThreads,
        }
      }),
    } satisfies ShellState
  }

  if (action === 'project.pin') {
    const projectId = getPayloadProjectId(payload)

    if (!projectId) {
      return currentState
    }

    return {
      ...currentState,
      projects: sortPinnedProjects(
        currentState.projects.map((project) =>
          project.id === projectId ? { ...project, pinned: !project.pinned } : project,
        ),
      ),
    } satisfies ShellState
  }

  return currentState
}

export function applyOptimisticPinUpdate(
  queryClient: QueryClient,
  action: DesktopAction,
  payload: ActionPayload,
) {
  queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) =>
    getOptimisticallyPinnedShellState(currentState ?? null, action, payload),
  )
}
