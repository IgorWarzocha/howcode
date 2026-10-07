import type { ComposerState } from '../desktop/types'

export type ComposerRuntimeModel = ReturnType<typeof getComposerRuntimeModel>

export function getComposerRuntimeModel(composer: ComposerState | null) {
  return {
    availableModels: composer?.availableModels ?? [],
    availableThinkingLevels: composer?.availableThinkingLevels ?? ['off'],
    contextUsage: composer?.contextUsage ?? null,
    currentModel: composer?.currentModel ?? null,
    currentThinkingLevel: composer?.currentThinkingLevel ?? 'off',
    isCompacting: composer?.isCompacting ?? false,
  }
}
