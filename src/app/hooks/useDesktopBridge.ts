import type { DesktopAction } from "../desktop/actions";
import type { DesktopActionPayload, DesktopActionResult } from "../desktop/types";

function hasElectrobunDesktopBridge() {
  return (
    typeof (window as Window & { __electrobunRpcSocketPort?: unknown })
      .__electrobunRpcSocketPort === "number"
  );
}

export function useDesktopBridge() {
  return async (
    action: DesktopAction,
    payload: DesktopActionPayload = {},
  ): Promise<DesktopActionResult | null> => {
    if (!window.piDesktop) {
      return null;
    }

    if (!hasElectrobunDesktopBridge()) {
      return {
        ok: false,
        at: new Date().toISOString(),
        payload: { action, payload },
        result: {
          error: "Electrobun RPC bridge is unavailable.",
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
}
