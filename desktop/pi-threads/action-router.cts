import type { DesktopAction } from "../../shared/desktop-actions.ts";
import type {
  AnyDesktopActionPayload,
  DesktopActionResultData,
} from "../../shared/desktop-contracts.ts";
import { assertUnhandledDesktopAction } from "./action-router-result.cts";
import { handleComposerDesktopAction } from "./composer-actions.cts";
import { handleNoopDesktopAction } from "./noop-actions.cts";
import { handlePiSettingsDesktopAction } from "./pi-settings-actions.cts";
import { handleProjectDesktopAction } from "./project-actions.cts";
import { handleSettingsDesktopAction } from "./settings-actions.cts";
import { handleThreadDesktopAction } from "./thread-actions.cts";
import { handleWorkspaceDesktopAction } from "./workspace-actions.cts";

export async function handleDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<DesktopActionResultData | null | undefined> {
  // Keep the public router thin: each domain owns its own action family and can grow
  // without turning this entrypoint back into a switch-based godfile.
  const handlers = [
    handleNoopDesktopAction(action),
    await handleProjectDesktopAction(action, payload),
    await handleThreadDesktopAction(action, payload),
    await handleComposerDesktopAction(action, payload),
    await handleWorkspaceDesktopAction(action, payload),
    handleSettingsDesktopAction(action, payload),
    await handlePiSettingsDesktopAction(action, payload),
  ];

  for (const handler of handlers) {
    if (handler.handled) {
      return handler.result;
    }
  }

  return assertUnhandledDesktopAction(action);
}
