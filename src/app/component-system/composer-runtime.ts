import type { ComposerRuntimeModel } from '@howaboua/howcode-sdk/composer-renderer'
import type { ComposerState } from '../desktop/types'

export function getComposerRuntimeModel(composer: ComposerState | null): ComposerRuntimeModel {
  return {
    availableModels: composer?.availableModels ?? [],
    availableThinkingLevels: composer?.availableThinkingLevels ?? ['off'],
    contextUsage: composer?.contextUsage ?? null,
    currentModel: composer?.currentModel ?? null,
    currentThinkingLevel: composer?.currentThinkingLevel ?? 'off',
    isCompacting: composer?.isCompacting ?? false,
  }
}
