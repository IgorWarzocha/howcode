import type { DesktopActionResult } from "./types";

export function getDesktopActionErrorMessage(
  actionResult: DesktopActionResult | null,
  fallbackMessage: string,
) {
  if (actionResult?.ok === false && typeof actionResult.result?.error === "string") {
    return actionResult.result.error;
  }

  if (typeof actionResult?.result?.error === "string") {
    return actionResult.result.error;
  }

  return actionResult?.ok === false ? fallbackMessage : null;
}
