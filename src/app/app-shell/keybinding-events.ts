import type { KeybindingCommandId } from '../../../shared/keybindings'

export const howcodeKeybindingCommandEvent = 'howcode:keybinding-command'

export type HowcodeKeybindingCommandDetail = {
  commandId: KeybindingCommandId
}

export function dispatchHowcodeKeybindingCommand(commandId: KeybindingCommandId) {
  window.dispatchEvent(
    new CustomEvent<HowcodeKeybindingCommandDetail>(howcodeKeybindingCommandEvent, {
      detail: { commandId },
    }),
  )
}
