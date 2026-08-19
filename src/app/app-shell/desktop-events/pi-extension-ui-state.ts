import type { Dispatch, SetStateAction } from 'react'
import type { ComposerState, PiExtensionUiState } from '../../desktop/types'

function extensionWidgetListsEqual(
  left: PiExtensionUiState['piExtensionWidgets'],
  right: PiExtensionUiState['piExtensionWidgets'],
) {
  return (
    left.length === right.length &&
    left.every((widget, index) => {
      const other = right[index]
      return (
        other?.key === widget.key &&
        other.placement === widget.placement &&
        other.lines.length === widget.lines.length &&
        other.lines.every((line, lineIndex) => line === widget.lines[lineIndex])
      )
    })
  )
}

function extensionStatusListsEqual(
  left: PiExtensionUiState['piExtensionStatuses'],
  right: PiExtensionUiState['piExtensionStatuses'],
) {
  return (
    left.length === right.length &&
    left.every((status, index) => {
      const other = right[index]
      return other?.key === status.key && other.text === status.text
    })
  )
}

function extensionDialogsEqual(
  left: PiExtensionUiState['piExtensionDialogRequest'],
  right: PiExtensionUiState['piExtensionDialogRequest'],
) {
  if (!(left && right)) return left === right
  const leftOptions = left.options ?? []
  const rightOptions = right.options ?? []
  return (
    left.id === right.id &&
    left.method === right.method &&
    left.title === right.title &&
    left.message === right.message &&
    left.placeholder === right.placeholder &&
    left.prefill === right.prefill &&
    leftOptions.length === rightOptions.length &&
    leftOptions.every((option, index) => option === rightOptions[index])
  )
}

export function extensionUiStatesEqual(left: PiExtensionUiState, right: PiExtensionUiState) {
  return (
    extensionWidgetListsEqual(left.piExtensionWidgets, right.piExtensionWidgets) &&
    extensionStatusListsEqual(left.piExtensionStatuses, right.piExtensionStatuses) &&
    extensionDialogsEqual(left.piExtensionDialogRequest, right.piExtensionDialogRequest)
  )
}

export function getComposerExtensionUi(composer: ComposerState): PiExtensionUiState {
  return {
    piExtensionWidgets: composer.piExtensionWidgets,
    piExtensionStatuses: composer.piExtensionStatuses,
    piExtensionDialogRequest: composer.piExtensionDialogRequest,
  }
}

export function applyPiExtensionUiState(input: {
  extensionUi: PiExtensionUiState
  sessionPath: string | null
  setPiExtensionUiStateBySession: Dispatch<SetStateAction<Record<string, PiExtensionUiState>>>
}) {
  if (!input.sessionPath) return
  const sessionPath = input.sessionPath
  input.setPiExtensionUiStateBySession((current) => {
    const currentUi = current[sessionPath]
    if (currentUi && extensionUiStatesEqual(currentUi, input.extensionUi)) return current
    return { ...current, [sessionPath]: input.extensionUi }
  })
}
