import type { DesktopAction } from '../../shared/desktop-actions.ts'
import type {
  AnyDesktopActionPayload,
  DesktopActionResultData,
} from '../../shared/desktop-contracts.ts'
import { codingHostPlugin } from '../toolkit/coding-actions.ts'
import { assertUnhandledDesktopAction } from './action-router-result.ts'
import { handleChatDesktopAction } from './chat-actions.ts'
import { handleComposerDesktopAction } from './composer-actions.ts'
import { handlePiSettingsDesktopAction } from './pi-settings-actions.ts'
import { handleSettingsDesktopAction } from './settings-actions.ts'
import { handleThreadDesktopAction } from './thread-actions.ts'

export async function handleDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<DesktopActionResultData | null | undefined> {
  const handlers = [
    codingHostPlugin.handleAction,
    handleChatDesktopAction,
    handleThreadDesktopAction,
    handleComposerDesktopAction,
    handleSettingsDesktopAction,
    handlePiSettingsDesktopAction,
  ]

  for (const handler of handlers) {
    const result = await handler(action, payload)
    if (result.handled) {
      return result.result
    }
  }

  return assertUnhandledDesktopAction(action)
}
