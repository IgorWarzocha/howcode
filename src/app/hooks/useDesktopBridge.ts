import { useEffect, useState } from "react";
import type { DesktopAction } from "../desktop/actions";
import type { DesktopActionInvoker, DesktopActionResult } from "../desktop/types";

export const desktopBridgeUnavailableMessage =
  "Desktop bridge is unavailable. Restart the dev server or run `bun run dev` for the full desktop app.";

export function hasDesktopBridge() {
  return typeof window !== "undefined" && typeof window.piDesktop?.invokeAction === "function";
}

export function useDesktopBridgeAvailable() {
  const [available, setAvailable] = useState(() => {
    if (!hasDesktopBridge()) {
      return false;
    }

    return !window.__howcodeDevWebBridge;
  });

  useEffect(() => {
    if (!hasDesktopBridge()) {
      setAvailable(false);
      return;
    }

    if (!window.__howcodeDevWebBridge) {
      setAvailable(true);
      return;
    }

    let cancelled = false;
    setAvailable(false);
    void fetch("/__howcode/config", { cache: "no-store" })
      .then((response) => {
        if (!cancelled) {
          setAvailable(response.ok);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailable(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return available;
}

export function useDesktopBridge() {
  const invokeDesktopAction: DesktopActionInvoker = async (
    action: DesktopAction,
    payload = {},
  ): Promise<DesktopActionResult | null> => {
    if (!hasDesktopBridge()) {
      return {
        ok: false,
        at: new Date().toISOString(),
        payload: { action, payload },
        result: {
          error: desktopBridgeUnavailableMessage,
        },
      };
    }

    const desktopBridge = window.piDesktop;
    if (!desktopBridge) {
      return {
        ok: false,
        at: new Date().toISOString(),
        payload: { action, payload },
        result: {
          error: desktopBridgeUnavailableMessage,
        },
      };
    }

    try {
      return await desktopBridge.invokeAction(action, payload);
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
