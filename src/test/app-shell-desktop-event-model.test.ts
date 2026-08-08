import { describe, expect, it } from 'vitest'
import { extensionUiStatesEqual } from '../app/app-shell/desktop-events/pi-extension-ui-state'
import type { PiExtensionUiState } from '../app/desktop/types'

function extensionUi(): PiExtensionUiState {
  return {
    piExtensionWidgets: [{ key: 'widget', lines: ['first', 'second'], placement: 'aboveEditor' }],
    piExtensionStatuses: [{ key: 'status', text: 'ready' }],
    piExtensionDialogRequest: {
      id: 'dialog',
      method: 'select',
      title: 'Choose',
      options: ['one', 'two'],
    },
  }
}

describe('app shell desktop event model', () => {
  it('recognizes equivalent extension UI snapshots', () => {
    expect(extensionUiStatesEqual(extensionUi(), extensionUi())).toBe(true)
  })

  it('detects nested widget and dialog changes', () => {
    const left = extensionUi()
    const changedWidget = extensionUi()
    changedWidget.piExtensionWidgets[0]?.lines.push('third')
    const changedDialog = extensionUi()
    changedDialog.piExtensionDialogRequest?.options?.reverse()

    expect(extensionUiStatesEqual(left, changedWidget)).toBe(false)
    expect(extensionUiStatesEqual(left, changedDialog)).toBe(false)
  })
})
