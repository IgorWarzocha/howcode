import type { DesktopAction } from "../../shared/desktop-actions.ts";
import type { ActionHandlerResult } from "./action-router-result.cts";
import { handledAction, unhandledAction } from "./action-router-result.cts";

const noopActions = new Set<DesktopAction>([
  "threads.filter",
  "project.actions",
  "project.create-worktree",
  "project.switch",
  "thread.actions",
  "thread.run-action",
  "workspace.open",
  "workspace.open-options",
  "workspace.handoff",
  "workspace.popout",
  "connections.add",
  "connections.dismiss-banner",
  "composer.attach-menu",
  "composer.dictate",
  "composer.host",
  "plugins.open-card",
  "automations.open-card",
  "debug.open-card",
  "landing.project-switcher",
  "diff.review",
  "terminal.close",
]);

export function handleNoopDesktopAction(action: DesktopAction): ActionHandlerResult {
  return noopActions.has(action) ? handledAction() : unhandledAction();
}
