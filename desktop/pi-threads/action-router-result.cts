import type { DesktopAction } from "../../shared/desktop-actions.ts";

export type ActionHandlerResult =
  | {
      handled: true;
      result?: Record<string, unknown> | null | undefined;
    }
  | {
      handled: false;
    };

export function handledAction(result?: Record<string, unknown> | null | undefined) {
  return {
    handled: true,
    result,
  } satisfies ActionHandlerResult;
}

export function unhandledAction() {
  return {
    handled: false,
  } satisfies ActionHandlerResult;
}

export function assertUnhandledDesktopAction(action: DesktopAction): never {
  throw new Error(`Unhandled desktop action: ${action}`);
}
