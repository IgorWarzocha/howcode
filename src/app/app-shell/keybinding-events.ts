import type { KeybindingCommandId } from '@howcode/shared/keybindings'
import { useEffect, useRef } from 'react'

export const howcodeKeybindingCommandEvent = 'howcode:keybinding-command'
export const howcodeDismissTransientUiEvent = 'howcode:dismiss-transient-ui'

export type HowcodeKeybindingCommandDetail = {
  commandId: KeybindingCommandId
}

export function dispatchHowcodeKeybindingCommand(commandId: KeybindingCommandId) {
  return !window.dispatchEvent(
    new CustomEvent<HowcodeKeybindingCommandDetail>(howcodeKeybindingCommandEvent, {
      cancelable: true,
      detail: { commandId },
    }),
  )
}

export function dispatchHowcodeDismissTransientUi() {
  window.dispatchEvent(new CustomEvent(howcodeDismissTransientUiEvent))
}

export function useHowcodeKeybindingCommand(
  commandId: KeybindingCommandId,
  handler: (event: CustomEvent<HowcodeKeybindingCommandDetail>) => void,
) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const handleCommand = (event: Event) => {
      const customEvent = event as CustomEvent<HowcodeKeybindingCommandDetail>
      if (customEvent.detail?.commandId !== commandId) return
      handlerRef.current(customEvent)
    }

    window.addEventListener(howcodeKeybindingCommandEvent, handleCommand)
    return () => window.removeEventListener(howcodeKeybindingCommandEvent, handleCommand)
  }, [commandId])
}
