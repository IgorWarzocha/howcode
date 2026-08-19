import type { ComposerSendMode } from '@howcode/shared/keybindings'
import type { ComposerProps } from './composer-contract'

function getComposerSubmitHint(composerSendMode: ComposerSendMode) {
  return composerSendMode === 'cmd-enter' ? 'Cmd/Ctrl+Enter sends' : 'Enter sends'
}

function getComposerNewlineHint(composerSendMode: ComposerSendMode) {
  return composerSendMode === 'cmd-enter' ? 'Enter for a new line' : 'Shift+Enter for a new line'
}

export function getComposerPlaceholderText(input: {
  activeView: ComposerProps['activeView']
  composerSendMode: ComposerSendMode
  errorMessage: string | null
  showAskQuestions: boolean
}) {
  if (input.errorMessage) return input.errorMessage
  if (input.showAskQuestions) {
    const submitHint =
      input.composerSendMode === 'cmd-enter' ? 'Cmd/Ctrl+Enter replies' : 'Enter replies'
    const emptySubmitHint =
      input.composerSendMode === 'cmd-enter'
        ? 'empty Cmd/Ctrl+Enter advances'
        : 'empty Enter advances'
    return `Type Other · ${submitHint} · ${emptySubmitHint} · ←/→ questions · Esc dismisses`
  }
  const submitHint = getComposerSubmitHint(input.composerSendMode)
  if (input.activeView === 'chat' || input.activeView === 'thread') {
    return `Hover to type · ${submitHint} · ${getComposerNewlineHint(input.composerSendMode)}`
  }
  return `Hover to type · / commands · @ files · ${submitHint}`
}

export function isConversationComposerView(activeView: ComposerProps['activeView']) {
  return activeView === 'chat' || activeView === 'thread'
}
