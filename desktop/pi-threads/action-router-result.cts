import type { DesktopAction } from "../../shared/desktop-actions.ts";
import type { DesktopActionResultData } from "../../shared/desktop-contracts.ts";

export type ActionHandlerResult =
  | {
      handled: true;
      result?: DesktopActionResultData | null | undefined;
    }
  | {
      handled: false;
    };

export function handledAction(result?: DesktopActionResultData | null | undefined) {
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
