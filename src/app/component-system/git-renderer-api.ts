import type { GitRendererApi } from '@howaboua/howcode-git/renderer-api'

const exports: readonly (keyof GitRendererApi)[] = [
  'getOptimisticGitSettingsPatch',
  'prepareGitActionPayload',
  'handlesGitActionError',
  'createGitWorkspaceCommands',
  'createGitWorkspaceTransitions',
  'applyDiffPreferencesPostEffect',
  'applyDiffPreferencesToChat',
  'getDiffPreferencesPatch',
  'applyCommitOptionsPostEffect',
  'applyWorkspaceCommitPostEffect',
  'applyWorkspaceFileWritePostEffect',
  'invalidateDirectoryWorktreeQueries',
  'isGitDiffPreferences',
  'GitComposerControls',
  'notifyDirectoryDiffInvalidated',
  'getDirectoryDiffBaselinePreference',
  'getDirectoryDiffRenderModePreference',
]

export function isGitRendererApi(value: unknown): value is GitRendererApi {
  return Boolean(
    value &&
      typeof value === 'object' &&
      exports.every((name) => name in value && typeof Reflect.get(value, name) === 'function'),
  )
}
