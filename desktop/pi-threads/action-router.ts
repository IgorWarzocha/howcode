import type { DesktopAction } from '../../shared/desktop-actions.ts'
import type {
  AnyDesktopActionPayload,
  DesktopActionResultData,
} from '../../shared/desktop-contracts.ts'
import { assertUnhandledDesktopAction } from './action-router-result.ts'
import { handleChatDesktopAction } from './chat-actions.ts'
import { handleComposerDesktopAction } from './composer-actions.ts'
import { handlePiSettingsDesktopAction } from './pi-settings-actions.ts'
import { handleProjectDesktopAction } from './project-actions.ts'
import { handleSettingsDesktopAction } from './settings-actions.ts'
import { handleThreadDesktopAction } from './thread-actions.ts'
import { handleWorkspaceDesktopAction } from './workspace-actions.ts'

export async function handleDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<DesktopActionResultData | null | undefined> {
  // Keep the public router thin: each domain owns its own action family and can grow
  // without turning this entrypoint back into a switch-based godfile.
  const handlers = [
    await handleProjectDesktopAction(action, payload),
    await handleChatDesktopAction(action, payload),
    await handleThreadDesktopAction(action, payload),
    await handleComposerDesktopAction(action, payload),
    await handleWorkspaceDesktopAction(action, payload),
    await handleSettingsDesktopAction(action, payload),
    await handlePiSettingsDesktopAction(action, payload),
  ]

  for (const handler of handlers) {
    if (handler.handled) {
      return handler.result
    }
  }

  return assertUnhandledDesktopAction(action)
}
