import type { DesktopAction } from "../../shared/desktop-actions.ts";
import type { DesktopActionPayload } from "../../shared/desktop-contracts.ts";
import { assertUnhandledDesktopAction } from "./action-router-result.cts";
import { handleComposerDesktopAction } from "./composer-actions.cts";
import { handleNoopDesktopAction } from "./noop-actions.cts";
import { handleProjectDesktopAction } from "./project-actions.cts";
import { handleSettingsDesktopAction } from "./settings-actions.cts";
import { handleThreadDesktopAction } from "./thread-actions.cts";
import { handleWorkspaceDesktopAction } from "./workspace-actions.cts";

export async function handleDesktopAction(
  action: DesktopAction,
  payload: DesktopActionPayload,
): Promise<Record<string, unknown> | null | undefined> {
  const handlers = [
    handleNoopDesktopAction(action),
    await handleProjectDesktopAction(action, payload),
    await handleThreadDesktopAction(action, payload),
    await handleComposerDesktopAction(action, payload),
    await handleWorkspaceDesktopAction(action, payload),
    handleSettingsDesktopAction(action, payload),
  ];

  for (const handler of handlers) {
    if (handler.handled) {
      return handler.result;
    }
  }

  return assertUnhandledDesktopAction(action);
}
