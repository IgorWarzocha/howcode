import type { DesktopAction } from '../../shared/desktop-actions.ts'
import type {
  AnyDesktopActionPayload,
  DesktopActionResultData,
} from '../../shared/desktop-contracts.ts'
import { assertUnhandledDesktopAction } from './action-router-result.ts'
import { handleChatDesktopAction } from './chat-actions.ts'
import { handleComposerDesktopAction } from './composer-actions.ts'
import { handleSettingsDesktopAction } from './settings-actions.ts'
import { handleShellPreferencesDesktopAction } from './shell-preferences-actions.ts'
import { handleWorkspaceDesktopAction } from './workspace-actions.ts'

export async function handleDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<DesktopActionResultData | null | undefined> {
  const handlers = [
    handleWorkspaceDesktopAction,
    handleChatDesktopAction,
    handleComposerDesktopAction,
    handleSettingsDesktopAction,
    handleShellPreferencesDesktopAction,
  ]

  for (const handler of handlers) {
    const result = await handler(action, payload)
    if (result.handled) {
      return result.result
    }
  }

  return assertUnhandledDesktopAction(action)
}
