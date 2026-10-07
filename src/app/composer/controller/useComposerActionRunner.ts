import { useCallback } from 'react'
import { getDesktopActionErrorMessage } from '../../desktop/action-results'
import type { DesktopAction } from '../../desktop/actions'
import { getErrorMessage } from '../../desktop/error-messages'
import type { DesktopActionInvoker } from '../../desktop/types'

type ComposerOpenMenu = 'model' | 'picker' | null

export function useComposerActionRunner(input: {
  onAction: DesktopActionInvoker
  setErrorMessage: (message: string | null) => void
  setOpenMenu: React.Dispatch<React.SetStateAction<ComposerOpenMenu>>
}) {
  const { onAction, setErrorMessage, setOpenMenu } = input

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
      if (!result) return false

      if (options?.closeMenu ?? true) setOpenMenu(null)
      return true
    },
    [invokeComposerAction, setOpenMenu],
  )

  return { invokeComposerAction, runComposerAction }
}
