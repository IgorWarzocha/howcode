import { type RefObject, useEffect, useEffectEvent, useMemo, useRef } from 'react'
import type { DesktopAction } from '../desktop/actions'
import type {
  DesktopActionInvoker,
  DesktopActionResult,
  PiExtensionShortcut,
} from '../desktop/types'
import {
  getPiExtensionShortcutKey,
  isEditableEventTarget,
  isPlainPiExtensionShortcut,
  isRightAltKeyEvent,
  isRightAltPiExtensionShortcutEvent,
} from './pi-extension-shortcuts'

type UseComposerPiExtensionShortcutsInput = {
  chatGroupId?: string | null | undefined
  composerMode: 'chat' | 'code'
  composerPanelRef: RefObject<HTMLDivElement | null>
  draft: string
  invokeAction: (
    action: DesktopAction,
    payload: NonNullable<Parameters<DesktopActionInvoker>[1]>,
  ) => Promise<DesktopActionResult | null>
  overlayRef: RefObject<HTMLDivElement | null>
  projectId: string
  sessionPath: string | null
  setDraft: (value: string) => void
  shortcuts: PiExtensionShortcut[]
}

function isPiExtensionOverlayHovered(overlay: HTMLElement | null) {
  return Boolean(overlay?.matches(':hover'))
}

function shouldSkipPiExtensionShortcutForRightAlt(
  event: KeyboardEvent,
  rightAltPressedRef: React.MutableRefObject<boolean>,
) {
  if (isRightAltKeyEvent(event)) {
    rightAltPressedRef.current = true
    return true
  }
  return isRightAltPiExtensionShortcutEvent(event, rightAltPressedRef.current)
}

function canRunPiExtensionShortcut(input: {
  overlayHovered: boolean
  shortcut: string
  target: EventTarget | null
}) {
  if (!isPlainPiExtensionShortcut(input.shortcut)) return true
  return input.overlayHovered && !isEditableEventTarget(input.target)
}

function getComposerTextarea(composerPanel: HTMLElement | null) {
  const textarea = composerPanel?.querySelector('textarea')
  return textarea instanceof HTMLTextAreaElement ? textarea : undefined
}

function applyPiExtensionEditorResult(input: {
  composerPanel: HTMLElement | null
  editorSelectionEnd?: number | undefined
  editorSelectionStart?: number | undefined
  editorText: string
  setDraft: (value: string) => void
}) {
  input.setDraft(input.editorText)
  const selectionStart = input.editorSelectionStart ?? input.editorText.length
  const selectionEnd = input.editorSelectionEnd ?? selectionStart
  window.requestAnimationFrame(() => {
    const textarea = getComposerTextarea(input.composerPanel)
    if (!textarea) return
    textarea.focus()
    textarea.setSelectionRange(selectionStart, selectionEnd)
  })
}

export function useComposerPiExtensionShortcuts({
  chatGroupId,
  composerMode,
  composerPanelRef,
  draft,
  invokeAction,
  overlayRef,
  projectId,
  sessionPath,
  setDraft,
  shortcuts,
}: UseComposerPiExtensionShortcutsInput) {
  const rightAltPressedRef = useRef(false)
  const registeredShortcuts = useMemo(
    () => new Set(shortcuts.map((shortcut) => shortcut.shortcut.toLowerCase())),
    [shortcuts],
  )
  const handleShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (shouldSkipPiExtensionShortcutForRightAlt(event, rightAltPressedRef)) return
    const shortcut = getPiExtensionShortcutKey(event)
    if (!(shortcut && registeredShortcuts.has(shortcut))) return
    const overlayHovered = isPiExtensionOverlayHovered(overlayRef.current)
    if (!canRunPiExtensionShortcut({ overlayHovered, shortcut, target: event.target })) return
    const textarea = getComposerTextarea(composerPanelRef.current)
    event.preventDefault()
    event.stopPropagation()
    void invokeAction('composer.pi-extension-shortcut', {
      projectId,
      sessionPath,
      composerMode,
      chatGroupId,
      editorSelectionEnd: textarea?.selectionEnd,
      editorSelectionStart: textarea?.selectionStart,
      editorText: textarea?.value ?? draft,
      shortcut,
    }).then((result) => {
      const editorText = result?.result?.editorText
      if (typeof editorText !== 'string') return
      applyPiExtensionEditorResult({
        composerPanel: composerPanelRef.current,
        editorSelectionEnd: result?.result?.editorSelectionEnd,
        editorSelectionStart: result?.result?.editorSelectionStart,
        editorText,
        setDraft,
      })
    })
  })

  useEffect(() => {
    if (shortcuts.length === 0) return
    const handleKeyUp = (event: KeyboardEvent) => {
      if (isRightAltKeyEvent(event)) rightAltPressedRef.current = false
    }
    const resetRightAltPressed = () => {
      rightAltPressedRef.current = false
    }
    window.addEventListener('keydown', handleShortcut, { capture: true })
    window.addEventListener('keyup', handleKeyUp, { capture: true })
    window.addEventListener('blur', resetRightAltPressed)
    return () => {
      window.removeEventListener('keydown', handleShortcut, { capture: true })
      window.removeEventListener('keyup', handleKeyUp, { capture: true })
      window.removeEventListener('blur', resetRightAltPressed)
    }
  }, [shortcuts.length])
}
