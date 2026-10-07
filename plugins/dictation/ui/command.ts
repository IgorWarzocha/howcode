import { useHowcodeKeybindingCommand } from '../../../src/app/app-shell/keybinding-events'

export function useDictationCommand(input: {
  showDictationButton: boolean
  inputLocked: boolean
  toggleDictation: () => Promise<unknown>
}) {
  useHowcodeKeybindingCommand('dictation.toggle', (event) => {
    if (!(input.showDictationButton && !input.inputLocked)) return
    event.preventDefault()
    void input.toggleDictation()
  })
}
