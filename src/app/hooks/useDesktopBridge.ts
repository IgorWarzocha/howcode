import type { DesktopAction } from "../desktop/actions";
import type { DesktopActionInvoker, DesktopActionResult } from "../desktop/types";

function hasDesktopBridge() {
  return typeof window.piDesktop?.invokeAction === "function";
}

export function useDesktopBridge() {
  const invokeDesktopAction: DesktopActionInvoker = async (
    action: DesktopAction,
    payload = {},
  ): Promise<DesktopActionResult | null> => {
    if (!window.piDesktop) {
      return null;
    }

    if (!hasDesktopBridge()) {
      return {
        ok: false,
        at: new Date().toISOString(),
        payload: { action, payload },
        result: {
          error: "Desktop bridge is unavailable.",
        },
      };
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

  return invokeDesktopAction;
}
