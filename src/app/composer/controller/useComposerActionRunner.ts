import { useCallback } from 'react'
import { getDesktopActionErrorMessage } from '../../desktop/action-results'
import type { DesktopAction } from '../../desktop/actions'
import { getErrorMessage } from '../../desktop/error-messages'
import type { DesktopActionInvoker, DesktopActionResult } from '../../desktop/types'

type ComposerOpenMenu = 'model' | 'picker' | null

function isCancelledSessionTreeNavigate(action: DesktopAction, result: DesktopActionResult) {
  return action === 'composer.session-tree.navigate' && result.result?.sessionTreeNavigateCancelled
}

export function useComposerActionRunner(input: {
  onAction: DesktopActionInvoker
  setDraft: (value: string) => void
  setErrorMessage: (message: string | null) => void
  setOpenMenu: React.Dispatch<React.SetStateAction<ComposerOpenMenu>>
}) {
  const { onAction, setDraft, setErrorMessage, setOpenMenu } = input

  const invokeComposerAction = useCallback(
    async (action: DesktopAction, payload: NonNullable<Parameters<DesktopActionInvoker>[1]>) => {
      try {
        const result = await onAction(action, payload)
        const actionErrorMessage = getDesktopActionErrorMessage(
          result,
          'Could not update the composer.',
        )
        if (actionErrorMessage) {
          setErrorMessage(actionErrorMessage)
          return null
        }
        setErrorMessage(null)
        return result
      } catch (error) {
        setErrorMessage(getErrorMessage(error, 'Could not update the composer.'))
        return null
      }
    },
    [onAction, setErrorMessage],
  )

  const runComposerAction = useCallback(
    async (
      action: DesktopAction,
      payload: NonNullable<Parameters<DesktopActionInvoker>[1]>,
      options?: { closeMenu?: boolean } | undefined,
    ) => {
      const result = await invokeComposerAction(action, payload)
      if (!result || isCancelledSessionTreeNavigate(action, result)) return false

      if (action === 'composer.session-tree.navigate') {
        const editorText = result.result?.sessionTreeNavigateEditorText
        if (typeof editorText === 'string') setDraft(editorText)
      }
      if (options?.closeMenu ?? true) setOpenMenu(null)
      return true
    },
    [invokeComposerAction, setDraft, setOpenMenu],
  )

  return { invokeComposerAction, runComposerAction }
}
