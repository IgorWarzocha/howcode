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

    try {
      return await window.piDesktop.invokeAction(action, payload);
    } catch (error) {
      return {
        ok: false,
        at: new Date().toISOString(),
        payload: { action, payload },
        result: {
          error: error instanceof Error ? error.message : "Desktop action request failed.",
        },
      };
    }
  };
}
