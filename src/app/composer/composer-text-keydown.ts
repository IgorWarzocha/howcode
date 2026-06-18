import {
  type ComposerSendMode,
  eventToAcceleratorCandidates,
  isRightAltKeyEvent,
  isRightAltShortcutEvent,
  type KeybindingOverrides,
  normalizeAccelerator,
} from '@howcode/shared/keybindings'
import type { KeyboardEvent } from 'react'
import type { ComposerFileMentions } from './useComposerFileMentions'
import type { ComposerSkillMentions } from './useComposerSkillMentions'
import type { ComposerSlashCommands } from './useComposerSlashCommands'

let graphemeSegmenter: Intl.Segmenter | null = null
let rightAltPressed = false

function updateComposerTextRightAltState(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (isRightAltKeyEvent(event)) {
    rightAltPressed = true
    return
  }
  if (!event.altKey) rightAltPressed = false
}

function shouldSkipComposerTextShortcutForRightAlt(event: KeyboardEvent<HTMLTextAreaElement>) {
  updateComposerTextRightAltState(event)
  return isRightAltShortcutEvent(event, rightAltPressed)
}

function handleLockedComposerTextKey(
  event: KeyboardEvent<HTMLTextAreaElement>,
  inputLocked: boolean,
) {
  if (!inputLocked) return false
  event.preventDefault()
  return true
}

function handleComposerEscapeKey(
  event: KeyboardEvent<HTMLTextAreaElement>,
  input: ComposerKeyDownInput,
) {
  if (event.key !== 'Escape') return false
  if (input.dictationActive || input.dictationTranscribing) {
    event.preventDefault()
    void input.cancelDictation()
    return true
  }
  if (!input.onEscapeOverride?.()) return false
  event.preventDefault()
  return true
}

function getTextSegments(value: string) {
  if (!('Segmenter' in Intl)) {
    return Array.from(value, (segment, index) => ({ index, segment }))
  }

  graphemeSegmenter ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return [...graphemeSegmenter.segment(value)]
}

export type ComposerKeyDownInput = {
  cancelDictation: () => Promise<void>
  clearError: () => void
  dictationActive: boolean
  dictationTranscribing: boolean
  inputLocked: boolean
  onArrowNavigationOverride?: ((direction: 'previous' | 'next') => boolean) | undefined
  onEscapeOverride?: (() => boolean) | undefined
  onSubmitOverride?: (() => boolean) | undefined
  slashCommands: ComposerSlashCommands
  fileMentions: ComposerFileMentions
  skillMentions: ComposerSkillMentions
  setDraft: (value: string) => void
  composerSendMode: ComposerSendMode
  keybindings: KeybindingOverrides
}

function isCursorAtStart(textarea: HTMLTextAreaElement) {
  return textarea.selectionStart === textarea.selectionEnd && textarea.selectionStart === 0
}

function isCursorAtEnd(textarea: HTMLTextAreaElement) {
  return (
    textarea.selectionStart === textarea.selectionEnd &&
    textarea.selectionEnd === textarea.value.length
  )
}

function handleOpenAutocompleteKeyDown(
  event: KeyboardEvent<HTMLTextAreaElement>,
  input: ComposerKeyDownInput,
) {
  return (
    input.slashCommands.handleKeyDown(event) ||
    input.fileMentions.handleKeyDown(event) ||
    input.skillMentions.handleKeyDown(event)
  )
}

function handleDeleteTextKey(
  event: KeyboardEvent<HTMLTextAreaElement>,
  setDraft: (value: string) => void,
  clearError: () => void,
) {
  if (event.key !== 'Backspace' && event.key !== 'Delete') return false
  if (event.altKey || event.ctrlKey || event.metaKey) return false
  const textarea = event.currentTarget
  const selectionStart = textarea.selectionStart
  const selectionEnd = textarea.selectionEnd
  const segments = getTextSegments(textarea.value)
  const previousSegment = [...segments].reverse().find((segment) => segment.index < selectionStart)
  const nextSegment = segments.find((segment) => segment.index > selectionEnd)
  const deleteStart =
    selectionStart === selectionEnd && event.key === 'Backspace'
      ? (previousSegment?.index ?? 0)
      : selectionStart
  const deleteEnd =
    selectionStart === selectionEnd && event.key === 'Delete'
      ? (nextSegment?.index ?? textarea.value.length)
      : selectionEnd
  if (deleteStart === deleteEnd) return false
  event.preventDefault()
  const nextValue = `${textarea.value.slice(0, deleteStart)}${textarea.value.slice(deleteEnd)}`
  setDraft(nextValue)
  clearError()
  window.requestAnimationFrame(() => textarea.setSelectionRange(deleteStart, deleteStart))
  return true
}

function handleHorizontalBoundaryNavigation(
  event: KeyboardEvent<HTMLTextAreaElement>,
  onArrowNavigationOverride: ((direction: 'previous' | 'next') => boolean) | undefined,
) {
  if (
    event.key === 'ArrowLeft' &&
    isCursorAtStart(event.currentTarget) &&
    onArrowNavigationOverride?.('previous')
  ) {
    event.preventDefault()
    return true
  }
  if (
    event.key === 'ArrowRight' &&
    isCursorAtEnd(event.currentTarget) &&
    onArrowNavigationOverride?.('next')
  ) {
    event.preventDefault()
    return true
  }
  return false
}

function isComposerSubmitKey(event: KeyboardEvent<HTMLTextAreaElement>, mode: ComposerSendMode) {
  if (event.key !== 'Enter') return false
  if (mode === 'cmd-enter') return event.metaKey || event.ctrlKey
  return !(event.shiftKey || event.metaKey || event.ctrlKey)
}

function getComposerDefaultAccelerators(
  commandId: 'composer.newline' | 'composer.submit',
  mode: ComposerSendMode,
) {
  if (commandId === 'composer.submit') return mode === 'cmd-enter' ? ['CmdOrCtrl+Enter'] : ['Enter']
  return mode === 'cmd-enter' ? ['Enter'] : ['Shift+Enter']
}

function matchesComposerCommandKey(
  event: KeyboardEvent<HTMLTextAreaElement>,
  input: ComposerKeyDownInput,
  commandId: 'composer.newline' | 'composer.submit',
) {
  if (isRightAltShortcutEvent(event, rightAltPressed)) return false
  const override = input.keybindings[commandId]
  if (override === null) return false
  const accelerators =
    typeof override === 'string'
      ? [override]
      : getComposerDefaultAccelerators(commandId, input.composerSendMode)
  const candidates = new Set(eventToAcceleratorCandidates(event))
  return accelerators.some((accelerator) => candidates.has(normalizeAccelerator(accelerator)))
}

function insertComposerNewline(
  event: KeyboardEvent<HTMLTextAreaElement>,
  setDraft: (value: string) => void,
) {
  const textarea = event.currentTarget
  const selectionStart = textarea.selectionStart
  const selectionEnd = textarea.selectionEnd
  const nextCursor = selectionStart + 1
  const nextValue = `${textarea.value.slice(0, selectionStart)}\n${textarea.value.slice(selectionEnd)}`
  event.preventDefault()
  setDraft(nextValue)
  window.requestAnimationFrame(() => textarea.setSelectionRange(nextCursor, nextCursor))
}

function handleComposerNewlineCommand(
  event: KeyboardEvent<HTMLTextAreaElement>,
  input: ComposerKeyDownInput,
) {
  if (!matchesComposerCommandKey(event, input, 'composer.newline')) return false
  if (event.key !== 'Enter' || event.altKey || event.ctrlKey || event.metaKey) {
    insertComposerNewline(event, input.setDraft)
  }
  return true
}

function composerCommandHasOverride(
  input: ComposerKeyDownInput,
  commandId: 'composer.newline' | 'composer.submit',
) {
  return Object.hasOwn(input.keybindings, commandId)
}

export function handleComposerTextKeyDown(
  event: KeyboardEvent<HTMLTextAreaElement>,
  input: ComposerKeyDownInput,
) {
  if (handleLockedComposerTextKey(event, input.inputLocked)) return
  if (shouldSkipComposerTextShortcutForRightAlt(event)) return
  if (handleComposerEscapeKey(event, input)) return
  if (handleDeleteTextKey(event, input.setDraft, input.clearError)) return
  if (handleOpenAutocompleteKeyDown(event, input)) return
  if (handleComposerNewlineCommand(event, input)) return
  if (
    matchesComposerCommandKey(event, input, 'composer.submit') ||
    (!composerCommandHasOverride(input, 'composer.submit') &&
      isComposerSubmitKey(event, input.composerSendMode))
  ) {
    event.preventDefault()
    if (!input.onSubmitOverride?.()) input.slashCommands.submit()
    return
  }
  if (handleHorizontalBoundaryNavigation(event, input.onArrowNavigationOverride)) return
}
