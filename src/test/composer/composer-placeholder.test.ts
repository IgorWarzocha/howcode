import { describe, expect, it } from 'vitest'
import { getComposerPlaceholderText } from '../../app/components/workspace/composer/composer-prompt-surface-helpers'

describe('composer placeholder text', () => {
  it('reflects Enter send mode', () => {
    expect(
      getComposerPlaceholderText({
        activeView: 'chat',
        composerSendMode: 'enter',
        errorMessage: null,
        showAskQuestions: false,
      }),
    ).toBe('Hover to type · Enter sends · Shift+Enter for a new line')
  })

  it('reflects Cmd/Ctrl+Enter send mode', () => {
    expect(
      getComposerPlaceholderText({
        activeView: 'chat',
        composerSendMode: 'cmd-enter',
        errorMessage: null,
        showAskQuestions: false,
      }),
    ).toBe('Hover to type · Cmd/Ctrl+Enter sends · Enter for a new line')
  })
})
