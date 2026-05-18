import type { ComposerProps } from '../composer'

export function getComposerPlaceholderText(input: {
  activeView: ComposerProps['activeView']
  errorMessage: string | null
  showAskQuestions: boolean
}) {
  if (input.errorMessage) return input.errorMessage
  if (input.showAskQuestions) {
    return 'Type Other · Enter replies · empty Enter advances · ←/→ questions · Esc dismisses'
  }
  if (input.activeView === 'chat' || input.activeView === 'thread') {
    return 'Hover to type · Enter sends · Shift+Enter for a new line'
  }
  return 'Hover to type · / commands · @ files · Enter sends'
}

export function isConversationComposerView(activeView: ComposerProps['activeView']) {
  return activeView === 'chat' || activeView === 'thread'
}
