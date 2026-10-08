import { getErrorMessage } from '@howaboua/howcode-sdk/errors'
import type { DesktopAction } from '../desktop/actions'
import type { DesktopActionInvoker, DesktopActionResult } from '../desktop/types'
import { hasDesktopBridgeQuery, invokeDesktopActionQuery } from '../query/desktop-query'

export const desktopBridgeUnavailableMessage =
  'Server connection is unavailable. Reload the page or check that the Howcode server is running.'

export function hasDesktopBridge() {
  return hasDesktopBridgeQuery()
}

export function useDesktopBridgeAvailable() {
  // Bootstrap authenticates the HTTP bridge before mounting the app.
  return hasDesktopBridge()
}

const invokeDesktopAction: DesktopActionInvoker = async (
  action: DesktopAction,
  payload = {},
): Promise<DesktopActionResult | null> => {
  if (!hasDesktopBridge()) {
    return {
      ok: false,
      at: new Date().toISOString(),
      payload: { action, payload },
      result: {
        error: desktopBridgeUnavailableMessage,
      },
    }
  }

  try {
    const result = await invokeDesktopActionQuery(action, payload)
    if (!result) {
      return {
        ok: false,
        at: new Date().toISOString(),
        payload: { action, payload },
        result: {
          error: desktopBridgeUnavailableMessage,
        },
      }
    }

    return result
  } catch (error) {
    return {
      ok: false,
      at: new Date().toISOString(),
      payload: { action, payload },
      result: {
        error: getErrorMessage(error, 'Server action request failed.'),
      },
    }
  }
}

export function useDesktopBridge() {
  return invokeDesktopAction
}
