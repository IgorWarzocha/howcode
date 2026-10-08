import { type RefObject, useEffect } from 'react'
import { useHowcodeKeybindingCommand } from '../../../src/app/app-shell/keybinding-events'
import { useLatestRef } from '../../../src/app/hooks/useLatestRef'

type DictationCommandTarget = {
  composerPanelRef: RefObject<HTMLElement | null>
  hasDictationSession: () => boolean
  defaultDictationTarget: boolean
  showDictationButton: boolean
  inputLocked: boolean
  toggleDictation: () => Promise<unknown>
}
const targets = new Set<RefObject<DictationCommandTarget>>()

function commandTarget() {
  const available = [...targets].filter(
    (target) => target.current.showDictationButton && !target.current.inputLocked,
  )
  return (
    available.find((target) => target.current.hasDictationSession()) ??
    available.find((target) =>
      target.current.composerPanelRef.current?.contains(document.activeElement),
    ) ??
    available.find((target) => target.current.defaultDictationTarget)
  )
}

export function useDictationCommand(input: DictationCommandTarget) {
  const target = useLatestRef(input)
  useEffect(() => {
    targets.add(target)
    return () => {
      targets.delete(target)
    }
  }, [target])
  useHowcodeKeybindingCommand('dictation.toggle', (event) => {
    if (event.defaultPrevented || commandTarget() !== target) return
    event.preventDefault()
    void input.toggleDictation()
  })
}
