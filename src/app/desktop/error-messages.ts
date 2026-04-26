const ELECTRON_REMOTE_ERROR_PREFIX = /^Error invoking remote method '[^']+':\s*/i;
const LEADING_ERROR_PREFIX = /^Error:\s*/i;

function stripKnownWrappers(message: string) {
  return message.trim().replace(ELECTRON_REMOTE_ERROR_PREFIX, "").replace(LEADING_ERROR_PREFIX, "");
}

export function cleanUserErrorMessage(
  message: string | null | undefined,
  fallback = "Something went wrong.",
) {
  if (!message) {
    return fallback;
  }

  const cleaned = stripKnownWrappers(message).replace(/\s+/g, " ").trim();
  return cleaned || fallback;
}

export function getErrorMessage(error: unknown, fallback: string) {
  return cleanUserErrorMessage(error instanceof Error ? error.message : null, fallback);
}
