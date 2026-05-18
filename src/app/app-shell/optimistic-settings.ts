import {
  isKeybindingCommandId,
  isValidAccelerator,
  normalizeAccelerator,
} from '../../../shared/keybindings'
import type {
  ComposerThinkingLevel,
  ModelSelection,
  ProjectDiffDefaultBaseline,
  ShellState,
} from '../desktop/types'
import type { ActionPayload } from './controller-action-utils'

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
  'devUpdateBranch',
  'betaUpdateBranch',
  'piTuiTakeover',
  'hoverToFocus',
  'hoverToBlur',
  'keybindings',
  'composerSendMode',
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
  if (payload.key === 'devUpdateBranch' || payload.key === 'betaUpdateBranch') {
    nextSettings.devUpdateBranch = payload.value
  }
  if (payload.key === 'piTuiTakeover') nextSettings.piTuiTakeover = payload.value
  if (payload.key === 'hoverToFocus') nextSettings.hoverToFocus = payload.value
  if (payload.key === 'hoverToBlur') nextSettings.hoverToBlur = payload.value
}

function applyOptimisticKeybindingSetting(
  nextSettings: ShellState['appSettings'],
  payload: ActionPayload,
) {
  if (
    payload.key === 'composerSendMode' &&
    (payload.value === 'enter' || payload.value === 'cmd-enter')
  ) {
    nextSettings.composerSendMode = payload.value
  }
  if (payload.key === 'keybindings') nextSettings.keybindings = getOptimisticKeybindings(payload)
}

function getOptimisticKeybindings(
  payload: ActionPayload,
): ShellState['appSettings']['keybindings'] {
  if (!(payload.value && typeof payload.value === 'object' && !Array.isArray(payload.value)))
    return {}
  const overrides: ShellState['appSettings']['keybindings'] = {}
  for (const [key, value] of Object.entries(payload.value)) {
    if (!isKeybindingCommandId(key)) continue
    if (value === null) overrides[key] = null
    else if (typeof value === 'string' && isValidAccelerator(value)) {
      overrides[key] = normalizeAccelerator(value)
    }
  }
  return overrides
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
  applyOptimisticKeybindingSetting(appSettings, payload)

  return { ...currentState, appSettings } satisfies ShellState
}
