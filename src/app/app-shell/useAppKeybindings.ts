import {
  eventToAcceleratorCandidates,
  getEffectiveAccelerators,
  isRightAltKeyEvent,
  isRightAltShortcutEvent,
  type KeybindingCommandId,
  type KeybindingOverrides,
} from '@howcode/shared/keybindings'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { runAppCommand, stopActiveRun } from './keybinding-command-handlers'
import {
  appLevelShortcutsAreBlocked,
  appShortcutCanRunFromTextInput,
  eventTargetIsEditable,
  rendererCommandIds,
} from './keybinding-context'
import type { HowcodeKeybindingCommandDetail } from './keybinding-events'
import {
  dispatchHowcodeKeybindingCommand,
  howcodeKeybindingCommandEvent,
} from './keybinding-events'
import type { KeybindingRuntime } from './keybinding-runtime'
import type { AppShellController } from './useAppShellController'

function useLatest<T>(value: T) {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}

function handleEscape(
  event: KeyboardEvent,
  runtime: KeybindingRuntime,
  lastEscapeAtRef: React.MutableRefObject<number>,
) {
  const now = Date.now()
  const isDoubleEscape = now - lastEscapeAtRef.current < 650
  lastEscapeAtRef.current = now
  const commandId = runtime.acceleratorToCommand.get('Escape Escape')
  if (!(isDoubleEscape && commandId === 'agent.interrupt')) return
  if (!stopActiveRun(runtime)) {
    if (appLevelShortcutsAreBlocked('agent.interrupt', runtime)) return
    if (!dispatchHowcodeKeybindingCommand('agent.interrupt')) return
  }
  event.preventDefault()
  event.stopImmediatePropagation()
}

function handleShortcut(event: KeyboardEvent, runtime: KeybindingRuntime) {
  const commandId = eventToAcceleratorCandidates(event)
    .map((accelerator) => runtime.acceleratorToCommand.get(accelerator))
    .find((value): value is KeybindingCommandId => value !== undefined)
  if (!commandId) return
  if (appLevelShortcutsAreBlocked(commandId, runtime)) return
  if (
    eventTargetIsEditable(event.target) &&
    !appShortcutCanRunFromTextInput(commandId, event, runtime)
  ) {
    return
  }
  const handled = runAppCommand(commandId, runtime)
  if (!handled) return
  event.preventDefault()
  event.stopImmediatePropagation()
}

function shouldSkipShortcutForRightAlt(
  event: KeyboardEvent,
  rightAltPressedRef: React.MutableRefObject<boolean>,
) {
  if (isRightAltKeyEvent(event)) {
    rightAltPressedRef.current = true
    return true
  }
  if (!event.altKey) rightAltPressedRef.current = false
  return isRightAltShortcutEvent(event, rightAltPressedRef.current)
}

export function useAppKeybindings(input: {
  controller: AppShellController
  keybindings: KeybindingOverrides
  onToggleSidebar: () => void
  onOpenSidebar: () => void
  onFocusComposer: () => void
  onFocusTerminal: () => void
}) {
  const {
    controller,
    keybindings,
    onFocusComposer,
    onFocusTerminal,
    onOpenSidebar,
    onToggleSidebar,
  } = input
  const acceleratorToCommand = useMemo(() => {
    const map = new Map<string, KeybindingCommandId>()
    for (const [commandId, accelerators] of getEffectiveAccelerators(keybindings)) {
      for (const accelerator of accelerators) {
        map.set(accelerator, commandId)
      }
    }
    return map
  }, [keybindings])
  const lastEscapeAtRef = useRef(0)
  const rightAltPressedRef = useRef(false)
  const cycleSelectionRef = useRef<KeybindingRuntime['cycleSelectionRef']['current']>(null)
  const latest = useLatest({
    acceleratorToCommand,
    appController: controller,
    cycleSelectionRef,
    onFocusComposer,
    onFocusTerminal,
    onOpenSidebar,
    onToggleSidebar,
  })

  useEffect(() => {
    const current = cycleSelectionRef.current
    if (!current) return
    if (
      current.view !== (controller.state.activeView === 'chat' ? 'chat' : 'thread') ||
      current.projectId !== controller.state.selectedProjectId ||
      current.threadId !== controller.state.selectedThreadId
    ) {
      cycleSelectionRef.current = null
    }
  }, [
    controller.state.activeView,
    controller.state.selectedProjectId,
    controller.state.selectedThreadId,
  ])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (shouldSkipShortcutForRightAlt(event, rightAltPressedRef)) return
      if (event.key === 'Escape') handleEscape(event, latest.current, lastEscapeAtRef)
      else handleShortcut(event, latest.current)
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (isRightAltKeyEvent(event)) rightAltPressedRef.current = false
    }
    const resetRightAltPressed = () => {
      rightAltPressedRef.current = false
    }
    const handleCommand = (event: Event) => {
      const commandId = (event as CustomEvent<HowcodeKeybindingCommandDetail>).detail?.commandId
      if (!commandId || rendererCommandIds.has(commandId)) return
      if (appLevelShortcutsAreBlocked(commandId, latest.current)) return
      runAppCommand(commandId, latest.current)
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    window.addEventListener('keyup', handleKeyUp, { capture: true })
    window.addEventListener('blur', resetRightAltPressed)
    window.addEventListener(howcodeKeybindingCommandEvent, handleCommand)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      window.removeEventListener('keyup', handleKeyUp, { capture: true })
      window.removeEventListener('blur', resetRightAltPressed)
      window.removeEventListener(howcodeKeybindingCommandEvent, handleCommand)
    }
  }, [latest])
}
