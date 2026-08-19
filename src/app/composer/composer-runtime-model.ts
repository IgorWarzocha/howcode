import type { ComposerState, PiExtensionUiState } from '../desktop/types'

export type ComposerRuntimeModel = ReturnType<typeof getComposerRuntimeModel>

export function getComposerRuntimeModel(
  composer: ComposerState | null,
  extensionUi: PiExtensionUiState | null,
) {
  return {
    availableModels: composer?.availableModels ?? [],
    availableThinkingLevels: composer?.availableThinkingLevels ?? ['off'],
    contextUsage: composer?.contextUsage ?? null,
    currentModel: composer?.currentModel ?? null,
    currentThinkingLevel: composer?.currentThinkingLevel ?? 'off',
    isCompacting: composer?.isCompacting ?? false,
    isExtensionCommandRunning: composer?.isExtensionCommandRunning ?? false,
    piExtensionDialogRequest:
      extensionUi?.piExtensionDialogRequest ?? composer?.piExtensionDialogRequest ?? null,
    piExtensionShortcuts: composer?.piExtensionShortcuts ?? [],
    piExtensionStatuses: extensionUi?.piExtensionStatuses ?? composer?.piExtensionStatuses ?? [],
    piExtensionWidgets: extensionUi?.piExtensionWidgets ?? composer?.piExtensionWidgets ?? [],
    projectTrustRequest: composer?.projectTrustRequest ?? null,
  }
}
