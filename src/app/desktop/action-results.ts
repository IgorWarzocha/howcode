import type { DesktopActionResult } from "./types";
import { cleanUserErrorMessage } from "./error-messages";

export function getDesktopActionErrorMessage(
  actionResult: DesktopActionResult | null,
  fallbackMessage: string,
) {
  if (actionResult === null) {
    return cleanUserErrorMessage(null, fallbackMessage);
  }

  if (actionResult?.ok === false && typeof actionResult.result?.error === "string") {
    return cleanUserErrorMessage(actionResult.result.error, fallbackMessage);
  }

  if (typeof actionResult?.result?.error === "string") {
    return cleanUserErrorMessage(actionResult.result.error, fallbackMessage);
  }

  return actionResult.ok === false ? cleanUserErrorMessage(null, fallbackMessage) : null;
}
