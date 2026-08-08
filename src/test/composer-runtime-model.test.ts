import { describe, expect, it } from 'vitest'
import { getComposerRuntimeModel } from '../app/composer/composer-runtime-model'
import type { ComposerState, PiExtensionUiState } from '../app/desktop/types'

function composerState(): ComposerState {
  return {
    currentModel: null,
    availableModels: [],
    currentThinkingLevel: 'off',
    availableThinkingLevels: ['off'],
    queuedPrompts: [],
    piExtensionWidgets: [{ key: 'composer-widget', lines: ['composer'] }],
    piExtensionStatuses: [{ key: 'composer-status', text: 'composer' }],
    piExtensionShortcuts: [],
    piExtensionDialogRequest: null,
    projectTrustRequest: null,
    contextUsage: null,
    isCompacting: false,
    isExtensionCommandRunning: false,
  }
}

describe('composer runtime model', () => {
  it('provides an inert model before composer state loads', () => {
    expect(getComposerRuntimeModel(null, null)).toMatchObject({
      availableModels: [],
      availableThinkingLevels: ['off'],
      currentModel: null,
      currentThinkingLevel: 'off',
      isCompacting: false,
      isExtensionCommandRunning: false,
      piExtensionStatuses: [],
      piExtensionWidgets: [],
    })
  })

  it('prefers live extension UI while retaining composer-owned shortcuts', () => {
    const composer = composerState()
    composer.piExtensionShortcuts = [{ shortcut: 'ctrl+k', extensionPath: '/extensions/test.ts' }]
    const extensionUi: PiExtensionUiState = {
      piExtensionWidgets: [{ key: 'live-widget', lines: ['live'] }],
      piExtensionStatuses: [{ key: 'live-status', text: 'live' }],
      piExtensionDialogRequest: null,
    }

    const model = getComposerRuntimeModel(composer, extensionUi)

    expect(model.piExtensionWidgets).toBe(extensionUi.piExtensionWidgets)
    expect(model.piExtensionStatuses).toBe(extensionUi.piExtensionStatuses)
    expect(model.piExtensionShortcuts).toBe(composer.piExtensionShortcuts)
  })
})
