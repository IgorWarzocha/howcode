import type { ComposerStateRequest } from '../../shared/desktop-contracts.ts'
import { loadAppSettings } from '../app-settings/readers.ts'

export function getComposerDefaults(request: ComposerStateRequest) {
  const settings = loadAppSettings()
  const savedModel = request.composerMode === 'chat' ? settings.chatModel : settings.codeModel
  const selection = request.composerUseDefaultModel
    ? null
    : (request.composerModelSelection ?? savedModel)
  return {
    model: selection?.provider
      ? { provider: selection.provider, modelId: selection.id }
      : undefined,
    thinkingLevel:
      request.composerThinkingLevel ??
      (request.composerMode === 'chat' ? settings.chatThinkingLevel : settings.codeThinkingLevel) ??
      'off',
  }
}
