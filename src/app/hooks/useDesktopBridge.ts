import type { DesktopAction } from "../desktop/actions";
import type { DesktopActionPayload, DesktopActionResult } from "../desktop/types";

export function useDesktopBridge() {
  return async (
    action: DesktopAction,
    payload: DesktopActionPayload = {},
  ): Promise<DesktopActionResult | null> => {
    if (!window.piDesktop) {
      return null;
    }

    return window.piDesktop.invokeAction(action, payload);
  };
}
